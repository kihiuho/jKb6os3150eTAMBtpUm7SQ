'use strict';
 // declare the packages
let config = require('./config');
let Beanworker = require('fivebeans').worker;
let uuid = require('uuid');
let ExchangeRateHandler = require('./lib/exchange_rate_handler');
let winston = require('winston');

// options for fivebeans work connecting to the tube
let options =
	{ // generate the unique id
		id: uuid.v4(),
		host: config.beanstalkd_host,
		port: config.beanstalkd_port,
		handlers:	{
			exchange_rate: new ExchangeRateHandler(config)
		},
		ignoreDefault: true
	};

// declare the beanworker
let worker = new Beanworker(options);
worker.start([config.beanstalkd_tube]);


winston.info('beanworker:' + options.id + ' is watching on tube:' + config.beanstalkd_tube);
