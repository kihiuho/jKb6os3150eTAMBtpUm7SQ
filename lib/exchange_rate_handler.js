'use strict';
module.exports = function (config) {
// declare packages and imports
	let Promise = require('bluebird');
	let co = require('co');
	let request = require('co-request');
	let events = require('events');
	let util = require('util');
	let MongoRate = require('./mongo_rate');
	let Seed = require('./seed');
	let winston = require('winston');
/**
* Constructor for ExchangeRateHandler

* @Constructor
*/
	function ExchangeRateHandler() {
		this.type = config.seed_type;
// expose to eventEmitter.on() function that allows one or more Functions to be attached to named events emitted by the object
		events.EventEmitter.call(this);
		this.config = config;
		this.mongo_insert_rate = new MongoRate(config.mongo_url);
	}
// Inherit the prototype methods from the constructor of ExchangeRateHandler into EventEmitter.
	util.inherits(ExchangeRateHandler, events.EventEmitter);
/*
	*	Function: The handler function of fivebeans worker
	*	@param {Number} job_id - job id of the seed by the remote beanstalkd server
	*	@param {Object}	payload - job data of the seed by the beanstalkd server
 	*	@param {Function} callback - callback function with action action: [ 'success' | 'release' | 'bury' ]
*/
	ExchangeRateHandler.prototype.work = function (job_id, payload, callback) {
		let mongo_insert_rate = this.mongo_insert_rate;
		let handler = this;
		let seed;
		co(function* () {
			try {
				winston.info('The worker is processing the job: ' + job_id);
// create a new seed from the payload job data
				seed = new Seed(config, payload.from, payload.to, payload.success, payload.fail);
// get exchange from Yahoo because the robot is detected by xe.com
				let exchange_rate = yield getExchangeRateYahoo(payload.from, payload.to);
// save the job data into the mongodb
				let mongo_save = yield mongo_insert_rate.save(payload, exchange_rate);
//	put the seed back to the beanstalkd if success is less than 10 times
				let put_seed = yield seed.success_put();
// create json string for eventEmitter
				let emit_json = emit_success_Json(mongo_save, put_seed, payload, job_id, exchange_rate);
				winston.info('Success! The job with id:' + job_id + ' is processed with data:' + JSON.stringify(emit_json));
// emit the emit_json for unit test
				handler.emit('exchange_rate_handler', emit_json);
// callback function to destroy the seed in the beanstalkd
				callback('success');
			} catch (err) { // handle caught errors
				winston.error(err);
// retry in 3s if any error during the get rate attempt and bury the job after 3 tries
				let seed_fail = yield seed.fail_put();
// create json string for eventEmitter
				let emit_json = emit_fail_Json(seed_fail, payload, job_id);
				winston.info('Fail! The job with id:' + job_id + ' is processed with data:' + JSON.stringify(emit_json));
// emit the emit_json for unit test
				handler.emit('exchange_rate_handler', emit_json);
// bury the job if more than 3 attempts
				if (seed_fail === 'FINISHED ALL ATTEMPTS WITH FAIL' || seed_fail === 'FAIL_COUNT IS INVALID') {
					callback('bury');
				} else if (isInteger(seed_fail)) {
// destroy the job if less 3 attempts
					callback('success');
				}
			}
		}).catch(function (err) {
// log any uncaught errors
			winston.error(err.message);
// bury the job if there is any uncaught errors
			callback('bury');
		});
	};
	/**
	* Function to verify the input is integer or not
	* @return {Object} regex result
*/
	function isInteger(input) {
		let regex = /\d/g;
		let check_format = regex.exec(input);
		return check_format;
	}
	/**
	* Function to concat a json for eventEmitter
	* @param {Promise} mongo_save - callback from mongodb server
	* @param {Number} put_seed - job_id returned back from the beanstalk after success reput
	* @param {Object} payload - job data from beantalkd server
	* @param {Number} job_id - job id associated with the payload
	* @param {Float} exchange_rate - exchange rate from Yahoo / Xe
	* @return {Object} : Json number concated from the function input parameters
	*/
	function emit_success_Json(mongo_save, put_seed, payload, job_id, exchange_rate) {
		let emitJson = {
			mongo_save: JSON.parse(mongo_save),
			put_seed: put_seed,
			payload: payload,
			job_id: job_id,
			exchange_rate: parseFloat(exchange_rate)
		};
		return emitJson;
	}
	/**
	* Function to concat a json for eventEmitter
	* @param {Number} put_fail - job_id returned back from the beanstalk after fail reput
	* @param {Object} payload - job data from beantalkd server
	* @param {Number} job_id - job id associated with the payload
	* @return {Object} : Json number concated from the function input parameters
	*/
	function emit_fail_Json(put_fail, payload, job_id) {
		let emitJson = {
			put_fail: put_fail,
			payload: payload,
			job_id: job_id
		};
		return emitJson;
	}
/**
* function to get exchange rate from xe.com
* @param {string} from - base currency
* @param {string} to - target currency
* @return {Promise} : {Number} exchange_rate ; if error, {String} err
*/
/*
	function getExchangeRate(from, to) {
		let currency = (from + '&To=' + to).toUpperCase();
		let url = 'http://www.xe.com/currencyconverter/convert/?From=' + currency;
		return new Promise(function (fulfill, reject) {
			co(function* () {
				let result = yield request(url);
				let str = result.body;
				let exchange_rate = parseFloat(str.substring(str.search('rightCol') + 10, str.search('rightCol') + 15)).toFixed(2);
				let check_format = /\d.\d\d/g;
// remember to check number
				if (str.search(currency) > 0 && check_format) {
					fulfill(exchange_rate);
				} else {
					console.log('Currency Not Matched');
					reject('Currency Not Matched');
				}
			}).catch(function (err) {
				console.err(err);
				reject(err);
			});
		});
	}*/
/**
* Function to get exchange rate from hk.finance.yahoo.com
* @param {string} from - base currency
* @param {string} to - target currency
* @return {Promise} : {Number} exchange_rate ; if error, {String} err
*/

	function getExchangeRateYahoo(from, to) {
// convert the input to Upper Case
		let currency = (from + to + '=X').toUpperCase();
// url of Yahoo for currency exchange
		let url = 'https://hk.finance.yahoo.com/q?s=' + currency;
		return new Promise(function (fulfill, reject) {
			co(function* () {
// send request to yahoo
				let result = yield request(url);
				let str = result.body;
// parse the exchange rate from the return html
				let exchange_rate = parseFloat(str.substring(str.search('time_rtq_ticker') + 23, str.search('time_rtq_ticker') + 28)).toFixed(2);
// check the format the the exchange rate
				let regex = /\d.\d\d/g;
				let check_format = regex.exec(exchange_rate);
				if (str.search(currency) > 0 && check_format) {
// return the exchange rate if success
					fulfill(exchange_rate);
				} else {
// log and return the error
					reject('Currency format is invalid');
				}
			}).catch(function (err) {
				reject(err);
			});
		});
	}
/*
	*	Declare the ExchangeRateHandler Object
	* @param {object} config - config parameters
	* @param {string} config.mongo_url - mongo url address
	* @param {string} config.beanstalkd_host - beanstalk server address
	* @param {string} config.beanstalkd_port - beanstalk server port
	* @param {string} config.beanstalkd_tube - beanstalk tube name
	* @param {string} config.seed_type - beanstalk seed type
*/
	let handler = new ExchangeRateHandler(config);
	return handler;
};
