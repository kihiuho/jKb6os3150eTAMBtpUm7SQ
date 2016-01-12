'use strict';
// declare packages and imports
let Promise = require('bluebird');
let co = require('co');
let winston = require('winston');
let mongoose = Promise.promisifyAll(require('mongoose'));
let Schema = mongoose.Schema;
// define the schema for the exhange_rate
let exchange_rate_schema = new Schema({
	from: {type: String, required: true},
	to: {type: String, required: true},
	created_at: {type: Date, default: Date.now},
	rate: {type: Number},
	seed_id: {type: String}
});
// decalare the Exchange Rate Model assoicated with the exchange rate schema
let ExchangeRateModel = mongoose.model('ExchangeRate', exchange_rate_schema);
/**
* Constructor for MonoRate
* @param {string} mongo_url - mongo url address

* @Constructor
*/
function MongoRate(mongo_url) {
	this.mongo_url = mongo_url;
	mongoose.connect(mongo_url);
}
/**
* Function to save payload and exchange_rate into DB
* @param {Object} payload - Seed from beanstalk server
* @param {Number} exchange_rate - currency rate
* @return {Promise} : {String} callback data from mongodb after success insertion ; if error, {String} err
*
*/
MongoRate.prototype.save = function (payload, exchange_rate) {
	let mongo_url = this.mongo_url;
	return new Promise(function (fulfill, reject)	{
		co(function* () {
			yield connectionReady(mongo_url);
// declare the ExchangeRateModel as input for DB insertion
			let model = new ExchangeRateModel({
				from: payload.from,
				to: payload.to,
				rate: exchange_rate});
// save the model into DB and return Stringify data from mongodb
			yield model.saveAsync().then(function (data) {fulfill(JSON.stringify(data));});
		}).catch(function (err) {
// log the error
			winston.error(err);
// return Promise with error
			reject(err);
		});
	});
};
/**
* Function to check the DB connection
* @param {String} mongo_url - url address connecting to the mongodb
* @return {Promise} : {String} mongodb connection status
*
*/
function connectionReady(mongo_url) {
	if (mongoose.connection.readyState) {
		return Promise.resolve(mongoose.connection.readyState);
	}	else {
		mongoose.connect(mongo_url);
		return Promise.reject(mongoose.connection.readyState);
	}
}


module.exports = MongoRate;
