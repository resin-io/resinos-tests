import * as bodyParser from 'body-parser';
import { ChildProcess, spawn } from 'child_process';
import { multiWrite } from 'etcher-sdk';
import * as express from 'express';
import * as http from 'http';
import { Readable } from 'stream';

import {
	getIpFromIface,
	getRuntimeConfiguration,
	resolveLocalTarget,
} from './helpers';
import { TestBotWorker } from './workers/testbot';

const workersDict: Dictionary<typeof TestBotWorker> = {
	testbot_hat: TestBotWorker,
};

async function setup(): Promise<express.Application> {
	const runtimeConfiguration = await getRuntimeConfiguration(
		Object.keys(workersDict),
	);

	const worker: Leviathan.Worker = new workersDict[
		runtimeConfiguration.workerType
	]({
		worker: { workdir: runtimeConfiguration.workdir },
		network: runtimeConfiguration.network,
		screenCapture: runtimeConfiguration.screenCapture
	});

	/**
	 * Server context
	 */
	const jsonParser = bodyParser.json();
	const app = express();
	const httpServer = http.createServer(app);

	const proxy: { proc?: ChildProcess; kill: () => void } = {
		kill: () => {
			if (proxy.proc != null) {
				proxy.proc.kill();
			}
		},
	};

	await worker.setup();

	/**
	 * Setup DeviceUnderTest routes
	 */
	app.post(
		'/dut/on',
		async (
			_req: express.Request,
			res: express.Response,
			next: express.NextFunction,
		) => {
			const timer = setInterval(() => {
				res.write('status: pending');
			}, httpServer.keepAliveTimeout);

			try {
				await worker.powerOn();
			} catch (err) {
				next(err);
			} finally {
				clearInterval(timer);
				res.write('OK');
				res.end();
			}
		},
	);
	app.post(
		'/dut/off',
		async (
			_req: express.Request,
			res: express.Response,
			next: express.NextFunction,
		) => {
			try {
				await worker.powerOff();
				res.send('OK');
			} catch (err) {
				next(err);
			}
		},
	);
	app.post(
		'/dut/network',
		jsonParser,
		async (
			req: express.Request,
			res: express.Response,
			next: express.NextFunction,
		) => {
			try {
				await worker.network(req.body);

				let ip;
				if (req.body.wired && (worker.state.network.wired != null)) {
					ip = {
						ip: getIpFromIface(worker.state.network.wired),
					};
				}
				if (req.body.wireless && (worker.state.network.wireless != null)) {
					ip = {
						ip: getIpFromIface(worker.state.network.wireless),
					};
				}
				if (ip == null) {
					throw new Error('DUT network could not be found');
				}

				res.send(ip);
			} catch (err) {
				console.error(err);
				next(err);
			}
		},
	);
	app.get(
		'/dut/ip',
		jsonParser,
		async (
			req: express.Request,
			res: express.Response,
			next: express.NextFunction,
		) => {
			try {
				if (req.body.target != null) {
					res.send(await resolveLocalTarget(req.body.target));
				} else {
					throw new Error('Target missing');
				}
			} catch (err) {
				next(err);
			}
		},
	);
	app.post(
		'/dut/capture',
		async (
			_req: express.Request,
			res: express.Response,
			next: express.NextFunction,
		) => {
			try {
				await worker.captureScreen('start');
				res.send('OK');
			} catch (err) {
				next(err);
			}
		},
	);
	app.get(
		'/dut/capture',
		async (
			_req: express.Request,
			res: express.Response,
			next: express.NextFunction,
		) => {
			try {
				await worker.captureScreen('stop');
				res.send('OK')
			} catch (err) {
				next(err);
			}
		},
	);

	app.post(
		'/proxy',
		jsonParser,
		async (
			req: express.Request,
			res: express.Response,
			next: express.NextFunction,
		) => {
			// For simplicity we will delegate to glider for now
			try {
				proxy.kill();
				if (req.body.port != null) {
					let ip;

					if (worker.state.network.wired != null) {
						ip = {
							ip: getIpFromIface(worker.state.network.wired),
						};
					}

					if (worker.state.network.wireless != null) {
						ip = {
							ip: getIpFromIface(worker.state.network.wireless),
						};
					}

					if (ip == null) {
						throw new Error('DUT network could not be found');
					}

					process.off('exit', proxy.kill);
					proxy.proc = spawn('glider', ['-listen', req.body.port]);
					process.on('exit', proxy.kill);

					res.send(ip);
				} else {
					res.send('OK');
				}
			} catch (err) {
				next(err);
			}
		},
	);
	app.post(
		'/teardown',
		async (
			_req: express.Request,
			res: express.Response,
			next: express.NextFunction,
		) => {
			try {
				await worker.teardown();
				proxy.kill();
				res.send('OK');
			} catch (e) {
				next(e);
			}
		},
	);
	app.use(function(
		err: Error,
		_req: express.Request,
		res: express.Response,
		_next: express.NextFunction,
	) {
		res.status(500).send(err.message);
	});
	app.post(
		'/dut/flash',
		async (req: express.Request, res: express.Response) => {
			function onProgress(progress: multiWrite.MultiDestinationProgress): void {
				res.write(`progress: ${JSON.stringify(progress)}`);
			}

			res.writeHead(202, {
				'Content-Type': 'text/event-stream',
				Connection: 'keep-alive',
			});

			const timer = setInterval(() => {
				res.write('status: pending');
			}, httpServer.keepAliveTimeout);

			try {
				worker.on('progress', onProgress);
				await worker.flash(req);
			} catch (e) {
				res.write(`error: ${e.message}`);
			} finally {
				worker.removeListener('progress', onProgress);
				res.write('status: done');
				res.end();
				clearInterval(timer);
			}
		},
	);

	return app;
}

export default setup;
