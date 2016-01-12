'use strict';
// declare the imports and packages
let Promise = require('bluebird');
let co = require('co');
let nodestalkerAsync = require('nodestalker-async');
// define the const parameters
// delay 3s and put the seed back to the beanstalk server after fail attempt
const FAIL_DELAY_SECOND = 3;
// delay 60s and the put back the seed after success try
const SUCCESS_DELAY_SECOND = 60;
// finished the job after 10 success attempt
const SUCCESS_ATTEMPT = 10;
// bury the job after 3 fail attempt
const FAIL_ATTEMPT = 3;
// allowed time-to-run in seconds
const TTR = 120;
// PRIORITY of the job
const PRIORITY = 0;
/**
* Constructor for Seed
* @param {Object} config
* @param {String} config.mongo_url - mongo url address
* @param {String} config.beanstalkd_host - beanstalk server address
* @param {String} config.beanstalkd_port - beanstalk server port
* @param {String} config.beanstalkd_tube - beanstalk tube name
* @param {String} config.seed_type - beanstalk seed type
* @param {String} from - base currency
* @param {String} to - target currency
* @param {Number} success - success count
* @param {Numner} fail - fail count

* @Constructor
*/
function Seed(config, from, to, success, fail) {
	this.config = config;
	this.from = from;
	this.to = to;
	this.success = success;
	this.fail = fail;
}
/**
* Function to convert the Seed Object to Json
* @return {String} : Stringify the the Seed Object
**/
Seed.prototype.toJson = function () {
	let seed = {
		type: this.config.seed_type,
		payload: {
			from: this.from,
			to: this.to,
			success: this.success,
			fail: this.fail
		}
	};
	return JSON.stringify(seed);
};
/**
* Function to put the seed to the beanstalkd server
* @param {Number} delay - time for the job to activate after reput in seconds
* @return {Promise}: {String} - job_id returned from the beanstalkd after reput; {String} - error messages
**/
Seed.prototype.put = function (delay) {
	let seed_to_tube_json = this.toJson();
	let config = this.config;
// declare the nodestalkClient for connecting to the beanstalk server
	let client = new nodestalkerAsync.Client(config.beanstalkd_host, config.beanstalkd_port);
	return new Promise(function (fulfill, reject) {
		co(function*() {
// use the beanstalkd with tube name
			yield client.useAsync(config.beanstalkd_tube);
// put the seed to the remote beanstalkd server with delay
			yield client.putAsync(seed_to_tube_json, PRIORITY, delay, TTR).then(function (job) {
// returned job_id from the beanstalkd server if success
				client.disconnect();
// return Promise with the job_id
				fulfill(job[0]);
			});
		});
	}).catch(function (err) {
// Error
		console.error(err);
// return Promise with err messages if any error
		return Promise.reject(err);
	});
};
/**
* Function to put the seed with 60 delay to the beanstalkd server if the exchange rate attempt success*
* @return {Promise}: {Sting} - job_id returned from the beanstalkd after reput if less than 10 success runs;
* {String} if seed count is equal to SUCCESS_ATTEMPT; {String} seed_count is not a valid number; {String} otherwise, error messages
**/
Seed.prototype.success_put = function () {
	let seed = this;
// success count increases by one
	seed.success++;
	return new Promise(function (fulfill, reject) {
		co(function*() {
// put the seed seed back to the beanstalk server if the success count is less than 10 times
			if (seed.success < SUCCESS_ATTEMPT && seed.success > 0) {
				yield seed.put(SUCCESS_DELAY_SECOND). then(function (job) {
// return the job id of reput seed
					fulfill(job[0]);
				});
			} else if (seed.success === SUCCESS_ATTEMPT) {
// return success if success count is equal to 10 times
				fulfill('FINISHED ALL ATTEMPTS WITH SUCCESS');
			} else {
				fulfill('SUCCESS_COUNT IS NOT A VALID NUMBER');
			}
		});
	}).catch(function (err) {
// uncaught error by co
		return Promise.reject(err);
	});
};
/**
* Function to put the seed with 3s to the beanstalkd server if the exchange rate attempt fails
* @return {Promise}: {Number} - job_id returned from the beanstalkd after reput if less than 3 fail runs;
* {String} if seed count is equal to FAIL_ATTEMPT; {String} seed_count is not a valid number; {String} otherwise, error messages
**/
Seed.prototype.fail_put = function () {
	let seed = this;
// fail count is increased by one
	seed.fail++;
	return new Promise(function (fulfill, reject) {
		co(function*() {
// put the seed seed back to the beanstalk server if the fail count is less than 3 times
			if (seed.fail < FAIL_ATTEMPT) {
				yield seed.put(FAIL_DELAY_SECOND).then(function (job) {
// return the job id of reput seed
					fulfill(job[0]);
				});
			} else if (seed.fail === FAIL_ATTEMPT) {
// bury the job if fail count is equal to 10 times
				fulfill('FINISHED ALL ATTEMPTS WITH FAIL');
			} else {
				fulfill('FAIL_COUNT IS INVALID');
			}
		}).catch(function (err) {
// Error
			return Promise.reject('FAIL PUT ERROR');
		});
	}).catch(function (err) {
// Error
		return Promise.reject('SUCCESS PUT ERROR');
	});
};

module.exports = Seed;
