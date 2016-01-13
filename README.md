### Task
----
Code a currency exchagne rate `worker`

1. Input currency `FROM` and `TO`, say USD to HKD, one currency conversation per job.
2. Get `FROM` and `TO` currency every 1 min, save 10 successful rate results to mongodb include the timestamp, then that currency converstaion job is done.
3. If any problem during the get rate attempt, retry it delay with 3s
4. If failed more than 3 times in total (not consecutive), bury the job.

### Installation
----
```sh
$ npm install
```
### Unit testing
----
Run the unit testing and eslint check
```sh
$ npm test
```
### Configuration
----
Change the options in the `config.js` to configure the mongoDB address and the beanstalkd server parameters
```js
module.exports = {
	mongo_url: 'mongodb url',
	beanstalkd_host: 'beanstalkd server address',
	beanstalkd_port: 'beanstalkd server port number',
	beanstalkd_tube: 'beanstalkd server tube name',
	seed_type: 'beanstalkd server seed type'
};
```
### How to use
----
1. Choose the currency `FROM` and `TO` in `producer_worker.js`.
	```js
    	let seed = new Seed(config, `FROM`, `TO`, 0, 0);
	```
	
2. Seed a job into the beanstalk server

	```sh
	$node producer_worker.js
	```
	
3. Run the `worker consumer` to get the job from beanstalkd server, to get the exchange rate form `Yahoo.com` then save into the mongodb. The `worker consumer` can be scaling horizontally by running the script on different machines.

	```sh
	$node consumer_worker.js
	```
	
	
# jKb6os3150eTAMBtpUm7SQ
