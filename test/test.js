'use strict';
// declare and import packages
let nodestalkerAsync = require('nodestalker-async');
let chai = require('chai');
let co = require('co');
let uuid = require('uuid');
let beanworker = require('fivebeans');
let winston = require('winston');
let expect = chai.expect;
let config = require('./../config');
let Seed = require('./../lib/seed');
let ExchangeRateHandler = require('./../lib/exchange_rate_handler');

// Unit test on the Seed
describe('Seed', function () {
	let client;
// before hook
	beforeEach(function (done) {
// declare the nodestalk client
		client = new nodestalkerAsync.Client(config.beanstalkd_host, config.beanstalkd_port);
		client.useAsync(config.beanstalkd_tube);
		done();
	});
// after hook
	afterEach(function () {
		client.disconnect();
	});
// unit test the function fail_put in Seed after the excahge rate attempt is failed and the fail count is less than 3 times
	describe('#fail_put', function () {
		describe('#fail_count < FAIL_ATTEMPT', function () {
// put the seed to the beanstalkd server
			let seed = new Seed(config, 'HKD', 'USD', 2, 1);
			it('fail_count is increased by one and reput the seed to the beanstalk server which becomes ready after 3s', function (done) {
				co(function*() {
// get the job id
					let job_id_seed = yield seed.fail_put();
// get the job stats
					let job_peek_stats = yield client.statsJobAsync(job_id_seed);
// peek the job from the beanstalk server
					let job_peek = yield client.peekAsync(job_id_seed);
// delete the job
					let delete_job = yield client.deleteJobAsync(job_id_seed);
// check the job delay with 3s
					expect(job_peek_stats[0].delay).to.equal(3);
// check the seed data is equal to the payload
					expect(seed.toJson()).to.equal(job_peek[0].data);
// check the job is deleted
					expect(delete_job[0][0]).to.equal('DELETED');
					done();
				}).catch(function (err) {
					winston.error(err);
				});
			});
		});
// Unit test for the function fail_put in Seed after the excahge rate attempt is failed and the fail count is equal to 3 times
		describe('#fail_count == FAIL_ATTEMPT', function () {
// put the seed to the beanstalkd server
			let seed = new Seed(config, 'HKD', 'USD', 9, 2);
			it('The job is failed and no further seed reput ', function (done) {
				co(function*() {
// get the job id
					let job_id_seed = yield seed.fail_put();
// expect the results is equal to 'FINISHED ALL ATTEMPTS WITH FAIL' if the fail attempt is 3 times
					expect(job_id_seed).to.equal('FINISHED ALL ATTEMPTS WITH FAIL');
					done();
				}).catch(function (err) {
					winston.error(err);
					expect(err).to.equal('FAIL PUT ERROR');
					done();
				});
			});
		});
	});
// Unit test for the function success_put in Seed after the excahge rate attempt is success
	describe('#success_put', function () {
// Unit test for the function success_put in Seed after the excahge rate attempt is success and the success count is less than 10 times
		describe('#success_count < SUCCESS_ATTEMPT', function () {
			let seed = new Seed(config, 'HKD', 'USD', 2, 1);
			it('success_count is increased by one and reput the seed to the beanstalk server which becomes ready after 60s', function (done) {
				co(function*() {
// get the job id
					let job_id_seed = yield seed.success_put();
// get the job stats
					let job_peek_stats = yield client.statsJobAsync(job_id_seed);
// peek the job from the beanstalkd server
					let job_peek = yield client.peekAsync(job_id_seed);
// delete the job after test
					let delete_job = yield client.deleteJobAsync(job_id_seed);
// check the job with delay 60s
					expect(job_peek_stats[0].delay).to.equal(60);
// check the job data is the same as the seed
					expect(seed.toJson()).to.equal(job_peek[0].data);
// check the job is deleted
					expect(delete_job[0][0]).to.equal('DELETED');
					done();
				}).catch(function (err) {
					console.log(err);
				});
			});
		});
// Unit test for the function success_put in Seed after the excahge rate attempt is success and the success count is equal to 10 times
		describe('#success_count == SUCCESS_ATTEMPT', function () {
// put the seed into the beanstalkd server
			let seed = new Seed(config, 'HKD', 'USD', 9, 1);
			it('The job is finished and no further seed reput ', function (done) {
				co(function*() {
// get the job id
					let job_id_seed = yield seed.success_put();
// check the job is finished after 10 success attempts
					expect(job_id_seed).to.equal('FINISHED ALL ATTEMPTS WITH SUCCESS');
					done();
				}).catch(function (err) {
					winston.error(err);
					expect(err).to.equal('SUCCESS PUT ERROR');
					done();
				});
			});
		});
	});
// Unit test for the function put in Seed
	describe('#put', function () {
		it('should return the same job number and json string', function (done) {
			let seed = new Seed(config, 'HKD', 'USD', 0, 0);
			co(function*() {
// get the job id
				let job_from_seed = yield seed.put(0);
				let job_id_seed = parseInt(job_from_seed, 10);
// peek the job
				let job_peek = yield client.peekAsync(job_id_seed);
				let job_id_peek = parseInt(job_peek[0].id, 10);
// delete the job
				let delete_job = yield client.deleteJobAsync(job_id_peek);
// check the job id
				expect(parseInt(job_from_seed, 10)).to.equal(job_id_peek);
// expect the seed is equal to the job data
				expect(seed.toJson()).to.equal(job_peek[0].data);
// deleted the job
				expect(delete_job[0][0]).to.equal('DELETED');
				done();
			}).catch(function (err) {
				winston.error(err);
			});
		});
	});
});

// Unit test for Worker Customer
describe('Consumer Worker', function () {
// set longer timeout
	this.timeout(800000);
// define the options for the bean worker
	let options =
		{
			id: uuid.v4(),
			host: config.beanstalkd_host,
			port: config.beanstalkd_port,
			handlers:
				{
					exchange_rate: new ExchangeRateHandler(config)
				},
			ignoreDefault: true
		};
	let worker;
	let client;
	let handler;
// before hook
	before(function (done) {
// decalre the bean worker
		worker = new beanworker.worker(options);
		worker.on('started', done);
		worker.start([config.beanstalkd_tube]);
// declare the nodestalker client for checking
		client = new nodestalkerAsync.Client(config.beanstalkd_host, config.beanstalkd_port);
		client.useAsync(config.beanstalkd_tube);
		// connect the event emitter to the worker handler
		handler = worker.handlers.exchange_rate;
	});
// after hook
	after(function () {
		worker.stop();
		client.disconnect();
	});

// Unit test for the work function in exchange_rate_handler to handle 10 times exchange rate attempts with success
	describe('#work_success', function () {
		let seed_put = -1;
// reset the count to zero
		let success_count = 0;
		it('save 10 successful rate results to mongodb then that currency converstaion job is done', function (done) {
// put the seed to the beanstalkd server
			let seed = new Seed(config, 'EUR', 'USD', 0, 1);
// listen to the beanwork handler
			handler.on('exchange_rate_handler', verifyResult);
			co(function*() {
// get the job id
				seed_put = yield seed.put(0);
			}).catch(function (err) {
				winston.error(err);
			});
// Callback function of the worker handler
// @param {Object} item - data from eventEmitter in function exchange_rate_handler.work
			function verifyResult(item)	{
// get the job_id
				seed_put = parseInt(seed_put, 10);
				let job_id = parseInt(item.job_id, 10);
// consider only job_id is matched because there is other job in the queue
				if (seed_put === job_id) {
// set the seed_put for next job_id matched
					seed_put = item.put_seed;
					// verify the object key callback from mongodb exists
					expect(item.mongo_save._id).to.exist;
					// verify the mongodb data
					expect(item.mongo_save.rate).to.equal(item.exchange_rate);
					expect(item.mongo_save.from).to.equal(item.payload.from);
					expect(item.mongo_save.to).to.equal(item.payload.to);
					expect(item.mongo_save.created_at).to.exist;
// finish the job if succeed 10 times
					if (success_count === 9) {
// remove the listen to the handler
						handler.removeListener('exchange_rate_handler', verifyResult);
// check the success_count is equal to 9
						expect(success_count).to.equal(9);
						done();
					} else {
// the succes_count is increased by one
						success_count ++;
					}
				}
			}
		});
	});
// Unit test for the work function in exchange_rate_handler to handle 3 times exchange rate attempts failed
	describe('#work_fail', function () {
		let seed_put = -1;
		let fail_count = 0;
		it('If any problem during the get rate attempt, retry it delay with 3s and bury the after 3 times in total', function (done) {
			co(function*() {
				// declare a new seed with curreny not existed
				let seed = new Seed(config, 'HKDD', 'USD', 3, 0);
				// listen to the beanworker handler
				handler.on('exchange_rate_handler', verifyError);
// get the job_id
				seed_put = yield seed.put(0);
			}).catch(function (err) {
				winston.error(err);
			});
			function verifyError(item) {
				seed_put = parseInt(seed_put, 10);
				let job_id = parseInt(item.job_id, 10);
				if (seed_put === job_id) {
// check the item.put_fail is number or not
					if (isInteger(item.put_fail)) {
// set the seed_put for the next callback
						seed_put = item.put_fail;
// fail_count is increased by one
						fail_count ++;
					} else if (fail_count === 2) {
// remove the listener if the job tried 3 times with fail
						handler.removeListener('exchange_rate_handler', verifyError);
// check the fail_count is equal to 2
						expect(fail_count).to.equal(2);
// check the put_fail returned the correct string after 3 fail tries
						expect(item.put_fail).to.equal('FINISHED ALL ATTEMPTS WITH FAIL');
						done();
					} else {
// check the put_fail returned the correct string if the fail count is invalid
						expect(item.put_fail).to.equal('FAIL_COUNT IS INVALID');
						done();
					}
				}
			}
			/**
			* Function to verify the input is integer or not
			* @return {Object} regex result
		*/
			function isInteger(input) {
				let regex = /\d/g;
				let check_format = regex.exec(input);
				return check_format;
			}
		});
	});
});
