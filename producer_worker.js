'use strict';
// declare the packages
let winston = require('winston');
let config = require('./config');
let Seed = require('./lib/seed');
let seed = new Seed(config, 'HKD', 'USD', 0, 0);
// put the seed to the beanstalkd server
seed.put(0);
winston.info('put seed to the beanstalkd server:' + config.beanstalkd_host + '@' + config.beanstalkd_tube);
winston.info(seed.toJson());
