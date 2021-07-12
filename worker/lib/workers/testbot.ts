import {
	DeviceInteractor,
	IntelNuc,
	RaspberryPi,
	TestBotHat,
	BalenaFin
} from '@balena/testbot';
import { EventEmitter } from 'events';
import { createWriteStream } from 'fs';
import { join } from 'path';
import * as Stream from 'stream';
import { manageHandlers } from '../helpers';
import ScreenCapture from '../helpers/graphics';
import NetworkManager, { Supported } from '../helpers/nm';

// TODO: Consider moving network and screen capture logic to testbot SDK.

const dutSerialPath = '/reports/dut-serial.txt';

const resolveDeviceInteractor = (hat: TestBotHat): DeviceInteractor => {
	if (process.env.TESTBOT_DUT_TYPE === 'fincm3') {
		return new BalenaFin(hat);
	}
	if (process.env.TESTBOT_DUT_TYPE === 'intel-nuc') {
		return new IntelNuc(hat);
	}
	return new RaspberryPi(hat);
};

/** Worker implementation based on testbot. */
class TestBotWorker extends EventEmitter implements Leviathan.Worker {
	private internalState: Leviathan.WorkerState = { network: {} };
	private readonly networkCtl?: NetworkManager;
	private readonly screenCapturer?: ScreenCapture;

	private readonly hatBoard: TestBotHat;
	private readonly deviceInteractor: DeviceInteractor;
	private dutLogStream: Stream.Writable | null = null;

	constructor(options: Leviathan.Options) {
		super();

		this.hatBoard = new TestBotHat();
		this.deviceInteractor = resolveDeviceInteractor(this.hatBoard);

		if (options != null) {
			if (options.network != null) {
				this.networkCtl = new NetworkManager(options.network);
			}

			if (options.screenCapture === true) {
				this.screenCapturer = new ScreenCapture(
					{
						type: 'v4l2src',
					},
					join(options.worker.workdir, 'capture'),
				);
			}
		}
	}

	get state() {
		return this.internalState;
	}

	public async setup() {
		await this.hatBoard.setup();
	}

	public async flash(stream: Stream.Readable) {
		console.log('Start flashing...');
		await this.deviceInteractor.flash(stream);
		console.log('Flashing completed.');
	}

	public async powerOn() {
		const dutLog = await this.hatBoard.openDutSerial();
		if (dutLog) {
			this.dutLogStream = createWriteStream(dutSerialPath);
			dutLog.pipe(this.dutLogStream);
		}
		console.log('Trying to power on DUT...');
		await this.deviceInteractor.powerOn();
		console.log('Vout=', await this.hatBoard.readVout());
	}

	public async powerOff() {
		console.log('Powering off DUT...');
		await this.deviceInteractor.powerOff();
		this.dutLogStream?.end();
	}

	public async network(configuration: Supported['configuration']) {
		console.log('Start network setup');
		if (this.networkCtl == null) {
			throw new Error('Network not configured on this worker. Ignoring...');
		}

		if (configuration.wireless != null) {
			console.log('Adding wireless connection...');
			this.internalState.network = {
				wireless: await this.networkCtl.addWirelessConnection(
					configuration.wireless,
				),
			};
		} else {
			await this.networkCtl.teardowns.wireless.run();
			this.internalState.network.wireless = undefined;
		}

		if (configuration.wired != null) {
			console.log('Adding wired connection...');
			this.internalState.network = {
				wired: await this.networkCtl.addWiredConnection(configuration.wired),
			};
		} else {
			await this.networkCtl.teardowns.wired.run();
			this.internalState.network.wired = undefined;
		}
		console.log('Network setup completed');
	}

	public async captureScreen(
		action: 'start' | 'stop',
	): Promise<void | Stream.Readable> {
		if (this.screenCapturer == null) {
			throw new Error('Screen capture not configured');
		}

		switch (action) {
			case 'start':
				return await this.screenCapturer.startCapture();
			case 'stop':
				return await this.screenCapturer.stopCapture();
		}
	}

	public async teardown(signal?: NodeJS.Signals): Promise<void> {
		console.log('Performing teardown...');
		try {
			manageHandlers(this.teardown, {
				register: false,
			});

			await this.hatBoard.teardown(signal === 'SIGTERM' || signal === 'SIGINT');

			if (this.screenCapturer != null) {
				await this.screenCapturer.teardown();
			}

			if (this.networkCtl != null) {
				await this.networkCtl.teardown();
			}
		} finally {
			if (signal != null) {
				process.kill(process.pid, signal);
			}
		}
	}
}

export { TestBotWorker };
