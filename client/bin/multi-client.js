#!/usr/bin/env node
import { BalenaCloudInteractor } from "../lib/balena";

process.env.NODE_CONFIG_DIR = `${__dirname}/../config`;
const config = require('config');

const ajv = new (require('ajv'))({ allErrors: true });
const balena = require('balena-sdk')({
	apiurl: config.get('balena.apiUrl'),
});
const blessed = require('blessed');
const { fork } = require('child_process');
const { ensureDir } = require('fs-extra');
const { fs } = require('mz');
const nativeFs = require('fs');
const request = require('request');
const rp = require('request-promise');
const schema = require('../lib/schemas/multi-client-config.js');
const { once, every, map } = require('lodash');
const { tmpdir } = require('os');
const url = require('url');
const path = require('path');
const yargs = require('yargs')
	.usage('Usage: $0 [options]')
	.option('h', {
		alias: 'help',
		description: 'display help message',
	})
	.option('c', {
		alias: 'config',
		description: 'configuration file for the multi run client',
		required: true,
		type: 'string',
	})
	.option('w', {
		alias: 'workdir',
		description: 'working directory',
		type: 'string',
		default: `${tmpdir()}/run`,
	})
	.option('p', {
		alias: 'print',
		description: 'print all output to stdout',
		type: 'boolean',
		default: false,
	})
	.option('n', {
		alias: 'non-interactive',
		description: 'use when calling from CI integrations',
		type: 'boolean',
		default: false,
	})
	.version()
	.help('help')
	.showHelpOnFail(false, 'Something went wrong! run with --help').argv;

class NonInteractiveState {
	constructor() {
		this.workersData = {};
	}

	info(data) {
		console.log(`INFO: ${data.toString()}`);
	}

	logForWorker(workerId, data) {
		const str = data.toString().trimEnd();
		const timestamp = new Date().toISOString()
		console.log(`[${timestamp}][${workerId}] ${str}`);
		this.workersData[workerId].workerLog.write(`${str}\n`, 'utf8');
	}

	attachPanel(elem) {
		let workerUrl = elem.workers;
		let suite = elem.suite.split(`/`).pop();

		let workerId;
		try {
			workerId = `${new url.URL(workerUrl).hostname
				.split(/\./, 2)[0]
				.substring(0, 7)}-${suite}`
		} catch (e) {
			console.error(e);
			workerId = elem.workers.toString();
			workerUrl = null;
		}

		let prefix = workerId;
		if (elem.workerPrefix) {
			prefix = `${workerId}-${elem.workerPrefix}`;
		}
		this.workersData[workerId] = {
			workerLog: nativeFs.createWriteStream(`reports/worker-${prefix}.log`),
			workerUrl,
			prefix,
		};

		let lastStatusPercentage = 0;

		elem.status = ({ message, percentage }) => {
			if (percentage - lastStatusPercentage > 10) {
				this.logForWorker(
					workerId,
					`${message} - ${Math.round(percentage)}%`,
				);
				lastStatusPercentage = percentage;
			}
		};
		elem.info = data => {
			lastStatusPercentage = 0;
			this.logForWorker(workerId, `INFO: ${data}`);
		};
		elem.log = data => {
			lastStatusPercentage = 0;
			this.logForWorker(workerId, data);
		};
		elem.teardown = () => this.teardownForWorker(workerId);
	}

	async teardownForWorker(workerId) {
		if (!this.workersData) {
			return;
		}
		const workerData = this.workersData[workerId];
		if (!workerData) {
			return;
		}
		delete this.workersData[workerId];

		workerData.workerLog.end();
		if (!workerData.workerUrl) {
			return;
		}
		const dutLogUrl = new URL('/reports/dut-serial.txt', workerData.workerUrl).href;
		console.log(`Downloading DUT serial log with ${dutLogUrl}`);
		const downloadLog = request
			.get(dutLogUrl)
			.pipe(nativeFs.createWriteStream(`reports/dut-serial-${workerData.prefix}.log`));
		let downloadLogDone =  new Promise(resolve =>
			downloadLog.on('end', resolve).on('error', resolve),
		);
		const dutArtifactUrl = new URL('/artifacts', workerData.workerUrl).href;
		console.log(`Downloading DUT artifacts with ${dutArtifactUrl}`);
		const downloadImages = request
			.get(dutArtifactUrl)
			.pipe(nativeFs.createWriteStream(`reports/artifacts-${workerData.prefix}.tar.gz`));
		let downloadArtifactDone =  new Promise(resolve =>
			downloadImages.on('end', resolve).on('error', resolve),
		);

		await Promise.all([downloadLogDone, downloadArtifactDone])
	}

	async teardown() {
		if (this.workersData) {
			const downloads = Object.keys(this.workersData).map(workerId =>
				this.teardownForWorker(workerId),
			);
			this.workersData = null;
			await Promise.all(downloads);
		}
	}
}

class State {
	constructor() {
		if (process.stdout.isTTY !== true) {
			throw new Error('The multi client requires a tty environmet to run in');
		}

		this.blessed = {
			screen: blessed.screen({
				log: 'client.log',
				dump: true,
				smartCSR: true,
			}),
		};

		this.blessed.main = {
			layout: blessed.layout({
				parent: this.blessed.screen,
				top: 'center',
				left: 'center',
				width: '100%',
				height: '100%',
				border: 'none',
			}),
		};

		this.blessed.main.info = blessed.text({
			label: 'main',
			align: 'left',
			parent: this.blessed.main.layout,
			width: '99%',
			height: '99%',
			border: 'line',
			scrollable: true,
			alwaysScroll: true,
			style: {
				border: {
					fg: '#009933',
				},
				label: {
					fg: '#009933',
				},
			},
		});

		this.blessed.screen.key(['C-c'], function () {
			process.kill(process.pid, 'SIGINT');
		});

		this.blessed.screen.render();
	}

	info(data) {
		this.blessed.main.info.setContent(` ${data.toString()}`);
		this.blessed.screen.render();
	}

	attachPanel(list) {
		this.blessed.main.info.height = '7%';

		list.forEach(elem => {
			const layout = blessed.layout({
				parent: this.blessed.main.layout,
				width: `${99 / list.length}%`,
				height: '93%',
			});

			const info = blessed.log({
				parent: layout,
				width: '100%',
				height: '20%',
				border: 'line',
				alwaysScroll: true,
				mouse: true,
				scrollable: true,
				style: {
					border: {
						fg: '#006600',
					},
				},
			});

			const status = blessed.progressbar({
				parent: layout,
				width: '100%',
				height: '6%',
				border: 'line',
				style: {
					bar: {
						bg: '#b35900',
					},
					border: {
						fg: '#ff9933',
					},
				},
			});

			const log = blessed.log({
				align: 'left',
				parent: layout,
				width: '100%',
				height: 'shrink',
				shrink: 'grow',
				border: 'line',
				scrollOnInput: true,
				mouse: true,
				scrollbar: true,
				style: {
					scrollbar: {
						bg: 'white',
					},
				},
			});

			status.hide();

			elem.status = ({ message, percentage }) => {
				percentage = Math.round(percentage);

				if (percentage !== 100) {
					if (status.hidden) {
						status.show();
					}
					status.setLabel(`${message} - ${percentage} %`);
					status.setProgress(percentage);
				} else {
					if (!status.hidden) {
						status.hide();
					}
				}
				this.blessed.screen.render();
			};
			elem.info = data => {
				info.setContent(` ${data.toString()}`);
				this.blessed.screen.render();
			};
			elem.log = data => {
				log.add(` ${data.toString().trimEnd()}`);
				this.blessed.screen.render();
			};
		});

		this.blessed.screen.render();
	}

	async teardown() {
		if (this.blessed) {
			this.blessed.screen.destroy();
			this.blessed = null;
		}
	}
}

(async () => {
	const state = yargs['non-interactive']
		? new NonInteractiveState()
		: new State();
	let runQueue = [];

	const children = {};

	// Exit handling
	process.on('exit', code => {
		process.exitCode = code || 1;

		if (Object.keys(children).length === 0) {
			console.log('No workers found...NO TESTS RAN');
		} else {
			process.exitCode =
				code ||
				(every(children, child => {
					return child.code === 0;
				})
					? 0
					: 1);

			if (yargs.print) {
				Object.values(children).forEach(child => {
					console.log(`=====| ${child.outputPath}`);
          try {
            console.log(fs.readFileSync(child.outputPath));
          } catch (e) {
            console.log(`${e}`);
          }
					console.log(`=====`);
				});
			}
		}

		console.log(
			`Exiting with ${process.exitCode}, client = ${code}, children: ${map(
				children,
				c => {
          switch (c.code) {
            case 0: return "0 (success)";
            case 1: return "1 (error)";         // client/lib/index.js#L401
            case 2: return "2 (test failure)";  // client/lib/index.js#L323
            case 3: return "3 (test error)";    // client/lib/index.js#L328
            default: return `${c.code} (exception)`; // For all other outcomes
          }
        },
			).join(',')}`,
		);
	});

	const signalHandler = once(async sig => {
		state.info('Cleaning up');
		// Prevent any new runs from happening
		runQueue = [];

		// Kill children.
		await Promise.all(
			map(children, child =>
				fs
					.readFile('/proc/' + child._child.pid + '/status')
					.catch(() => null)
					.then(
						procInfo =>
							new Promise((resolve, reject) => {
								if (
									procInfo != null &&
									procInfo.toString().match(/State:\s+[RSDT]/)
								) {
									child._child.on('exit', resolve);
									child._child.on('error', reject);
									child._child.kill(sig);
									state.info(`Killing PID ${child._child.pid}`);
								} else {
									resolve();
								}
							}),
					),
			),
		);

		await state.teardown();
	});
	// Signal Handling
	[
		'SIGINT',
		'SIGTERM',
	].forEach(signal => {
		process.on(signal, async sig => {
			await signalHandler(sig);
		});
	});

	try {
		await ensureDir(yargs.workdir);

		// Blessed setup for pretty terminal output

		let runConfigs = require(yargs.config);

		const validate = ajv.compile(schema);

		if (!validate(runConfigs)) {
			throw new Error(
				`Invalid configuration -> ${ajv.errorsText(validate.errors)}`,
			);
		}

		// runConfig needs to be iterable to handle scenarios even when only one config is provided in config.js
		runConfigs = Array.isArray(runConfigs) ? runConfigs : [runConfigs];

		state.info('Computing Run Queue');

		const balenaCloud = new BalenaCloudInteractor(balena);
		// Iterates through test jobs and pushes jobs to available testbot workers
		for (const runConfig of runConfigs) {
			if (runConfig.workers instanceof Array) {
				runConfig.workers.forEach(worker => {
					runQueue.push({ ...runConfig, workers: worker, matchingDevices: null });
				});
			} else if (runConfig.workers instanceof Object) {
				await balenaCloud.authenticate(runConfig.workers.apiKey);
				const matchingDevices = await balenaCloud.selectDevicesWithDUT(
					runConfig.workers.balenaApplication,
					runConfig.deviceType
				);

				//  Throw an error if no matching workers are found.
				if (matchingDevices.length === 0) {
					throw new Error(
						`No workers found for deviceType: ${runConfig.deviceType}`,
					);
				}

				runQueue.push({
					...runConfig,
					matchingDevices: matchingDevices,
					workers: null,
					workerPrefix: null,
				});
			}
		}

		state.info(`[Running Queue] Suites currently in queue: ${runQueue.map((run) => path.parse(run.suite).base)}`);
		const busyWorkers = []
		// While jobs are present the runQueue
		while (runQueue.length > 0) {
			const job = runQueue.pop();
			// If matching workers for the job are available then allot them a job
			if (job.matchingDevices !== null) { // specifically for an application since worker URL's are specific are automatically allocated
				for (var device of job.matchingDevices) {
					// check if device is idle & public URL is reachable
					let deviceUrl = await balenaCloud.resolveDeviceUrl(device)
					try{
						let status = await rp.get(new URL('/state', deviceUrl).href);
						if (status === "IDLE") {
							// make sure that the worker being targetted isn't already about to be used by another child process
							if(!busyWorkers.includes(deviceUrl)){
								// Create single client and break from loop to job the job 👍
								job.workers = deviceUrl
								job.workerPrefix = device.fileNamePrefix()
								break
							}
						}
					} catch(e) {
						state.info(`Couldn't retrieve worker ${device.deviceId} state...`)
					}
				}
			}

			if (job.workers === null) {
				// No idle workers currently - the job is pushed to the back of the queue
				await require('bluebird').delay(25000)
				runQueue.unshift(job)
			} else {
				// Start the job on the assigned worker
				state.attachPanel(job)
				const child = fork(
					path.join(__dirname, 'single-client'),
					[
						'-d',
						job.deviceType,
						'-i',
						job.image,
						'-c',
						job.config instanceof Object
							? JSON.stringify(job.config)
							: job.config,
						'-s',
						job.suite,
						'-u',
						job.workers,
					],
					{
						stdio: 'pipe',
						env: {
							CI: true,
						},
					},
				);

				// after creating child process, add the worker to the busy workers array
				busyWorkers.push(job.workers)

				// child state
				children[child.pid] = {
					_child: child,
					outputPath: `${yargs.workdir}/${new url.URL(job.workers).hostname ||
						child.pid}.out`,
					exitCode: 1,
				};

				child.on('message', ({ type, data }) => {
					switch (type) {
						case 'log':
							job.log(data);
							break;
						case 'status':
							job.status(data);
							break;
						case 'info':
							job.info(data);
							break;
						case 'error':
							job.log(data.message);
							break;
					}
				});

				child.on('error', console.error);
				child.stdout.on('data', job.log);
				child.stderr.on('data', job.log);

				job.info(`WORKER URL: ${job.workers}`);

				child.on('exit', code => {
					children[child.pid].code = code;
					if (job.teardown) {
						job.teardown();
					}
					// remove the worker from the busy array once the job is finished
					busyWorkers.splice(busyWorkers.indexOf(job.workers));
				});
			}
		}
	} catch (e) {
		state.info(
			`ERROR ENCOUNTERED: ${e.message}. \n Killing process in 10 seconds...`,
		);
		await require('bluebird').delay(10000);
		process.exitCode = process.exitCode || 999;
		process.kill(process.pid, 'SIGINT');
	}
})();
