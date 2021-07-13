/**
 * The worker class can be used to control the testbot hardware. In the `suite.js` file, you can
 * create an instance of it, and then use its methods to flash the DUT, power it on/off, and set up a
 * network AP for the DUT to connect to.
 *
 * @example
 * ```js
 *  const Worker = this.require('common/worker');
 *  this.suite.context.set({
 *      worker: new Worker(DEVICE_TYPE_SLUG, this.getLogger()), // Add an instance of worker to the context
 *  });
 *  const Worker = this.require('common/worker');
 *  const worker = new Worker(DEVICE_TYPE_SLUG, this.getLogger())
 * ```
 * @module Leviathan Worker helpers
 */

/*
 * Copyright 2018 balena
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const Bluebird = require('bluebird');
const retry = require('bluebird-retry');
const utils = require('../common/utils');
const config = require('config');
const isNumber = require('lodash/isNumber');
const { fs } = require('mz');
const once = require('lodash/once');
const pipeline = Bluebird.promisify(require('stream').pipeline);
const request = require('request');
const rp = require('request-promise');
const exec = Bluebird.promisify(require('child_process').exec);
module.exports = class Worker {
	constructor(
		deviceType,
		logger = { log: console.log, status: console.log, info: console.log },
	) {
		this.deviceType = deviceType;
		this.url = `${config.get('worker.url')}:${config.get('worker.port')}`;
		this.logger = logger;
	}

	/**
	 * Flash the provided OS image onto the connected DUT
	 *
	 * @param {string} imagePath path of the image to be flashed onto the DUT
	 *
	 * @category helper
	 */
	async flash(imagePath) {
		this.logger.log('Preparing to flash');

		await new Promise(async (resolve, reject) => {
			const req = rp.post({ uri: `${this.url}/dut/flash` });

			req.catch(error => {
				reject(error);
			});
			req.finally(() => {
				if (lastStatus !== 'done') {
					reject(new Error('Unexpected end of TCP connection'));
				}

				resolve();
			});

			let lastStatus;
			req.on('data', data => {
				const computedLine = RegExp('(.+?): (.*)').exec(data.toString());

				if (computedLine) {
					if (computedLine[1] === 'error') {
						req.cancel();
						reject(new Error(computedLine[2]));
					}

					if (computedLine[1] === 'progress') {
						once(() => {
							this.logger.log('Flashing');
						});
						// Hide any errors as the lines we get can be half written
						const state = JSON.parse(computedLine[2]);
						if (state != null && isNumber(state.percentage)) {
							this.logger.status({
								message: 'Flashing',
								percentage: state.percentage,
							});
						}
					}

					if (computedLine[1] === 'status') {
						lastStatus = computedLine[2];
					}
				}
			});

			pipeline(fs.createReadStream(imagePath), req);
		});
		this.logger.log('Flash completed');
	}

	/**
	 * Turn the DUT on
	 *
	 * @category helper
	 */
	async on() {
		this.logger.log('Powering on DUT');
		await rp.post(`${this.url}/dut/on`);
		this.logger.log('DUT powered on');
	}

	/**
	 * Turn the DUT off
	 *
	 * @category helper
	 */
	async off() {
		this.logger.log('Powering off DUT');
		await rp.post(`${this.url}/dut/off`);
	}

	async network(network) {
		await rp.post({
			uri: `${this.url}/dut/network`,
			body: network,
			json: true,
		});
	}

	proxy(proxy) {
		return rp.post({ uri: `${this.url}/proxy`, body: proxy, json: true });
	}

	ip(
		target,
		timeout = {
			interval: 10000,
			tries: 60,
		},
	) {
		return /.*\.local/.test(target)
			? retry(
					() => {
						return rp.get({
							uri: `${this.url}/dut/ip`,
							body: { target },
							json: true,
						});
					},
					{
						max_tries: timeout.tries,
						interval: timeout.interval,
						throw_original: true,
					},
			  )
			: target;
	}

	async teardown() {
		await rp.post({ uri: `${this.url}/teardown`, json: true });
	}

	capture(action) {
		switch (action) {
			case 'start':
				return rp.post({ uri: `${this.url}/dut/capture`, json: true });
			case 'stop':
				return request.get({ uri: `${this.url}/dut/capture` });
		}
	}

	/**
	 * Executes command-line operations in the host OS of the DUT. Assuming the DUT is
	 * connected to the access point broadcasted by the testbot:
	 *
	 * @example
	 * ```js
	 * const Worker = this.require('common/worker');
	 * const worker = new Worker(DEVICE_TYPE_SLUG, this.getLogger())
	 * await worker.executeCommandInHostOS('cat /etc/hostname', `${UUID}.local`);
	 * ```
	 *
	 * @param {string} command command to be executed on the DUT
	 * @param {string} target local UUID of the DUT, example:`${UUID}.local`
	 * @param {{"interval": number, "tries": number}} timeout object containing details of how many times the
	 * command needs to be retried and the intervals between each command execution
	 * @returns {string} Output of the command that was exected on hostOS of the DUT
	 *
	 * @category helper
	 */
	async executeCommandInHostOS(
		command,
		target,
		timeout = {
			interval: 10000,
			tries: 10,
		},
	) {
		let ip = /.*\.local/.test(target) ? await this.ip(target) : target;

		return retry(
			async () => {
				const result = await utils.executeCommandOverSSH(
					`source /etc/profile ; ${command}`,
					{
						host: ip,
						port: '22222',
						username: 'root',
					},
				);

				if (typeof result.code === 'number' && result.code !== 0) {
					throw new Error(
						`"${command}" failed. stderr: ${result.stderr}, stdout: ${result.stdout}, code: ${result.code}`,
					);
				}

				return result.stdout;
			},
			{
				max_tries: timeout.tries,
				interval: timeout.interval,
				throw_original: true,
			},
		);
	}

	/**
	 * Pushes a release to an application from a given directory for unmanaged devices
	 *
	 * @param {string} target  the <UUID> for the target device
	 * @param {string} source The path to the directory containing the docker-compose/Dockerfile for the containers
	 * @param {string} containerName The name of the container to verify is push has succeeded.
	 * @returns {string} returns state of the device
	 *
	 * @category helper
	 */
	async pushContainerToDUT(target, source, containerName) {
		await retry(
			async () => {
				await exec(
					`balena push ${target} --source ${source} --nolive --detached`,
				);
			},
			{
				max_tries: 10,
				interval: 5000,
			},
		);
		// now wait for new container to be available
		let state = {};
		await utils.waitUntil(async () => {
			state = await rp({
				method: 'GET',
				uri: `http://${target}:48484/v2/containerId`,
				json: true,
			});

			return state.services[containerName] != null;
		}, false);

		return state;
	}

	/**
	 * Executes the command in the targeted container of a device
	 * @param {string} command The command to be executed
	 * @param {string} containerName The name of the service/container to run the command in
	 * @param {*} target The `<UUID.local>` of the target device
	 * @returns {string} output of the command that is executed on the targetted container of the device
	 * @category helper
	 */
	async executeCommandInContainer(command, containerName, target) {
		// get container ID
		const state = await rp({
			method: 'GET',
			uri: `http://${target}:48484/v2/containerId`,
			json: true,
		});

		const stdout = await this.executeCommandInHostOS(
			`balena exec ${state.services[containerName]} ${command}`,
			target,
		);
		return stdout;
	}

	/**
	 * Triggers a reboot on the target device and waits until the device comes back online
	 *
	 * @param {string} target
	 * @category helper
	 */
	async rebootDut(target) {
		this.logger.log(`Rebooting the DUT`);
		await this.executeCommandInHostOS(
			`touch /tmp/reboot-check && systemd-run --on-active=2 reboot`,
			target,
		);
		await utils.waitUntil(async () => {
			return (
				(await this.executeCommandInHostOS(
					'[[ ! -f /tmp/reboot-check ]] && echo pass',
					target,
				)) === 'pass'
			);
		}, false);
		this.logger.log(`DUT has rebooted & is back online`);
	}

	/**
	 * Fetches OS version available on the DUT's `/etc/os-release` file
	 *
	 * @param {string} target
	 * @returns {string} returns OS version
	 * @category helper
	 */
	async getOSVersion(target) {
		// maybe https://github.com/balena-io/leviathan/blob/master/core/lib/components/balena/sdk.js#L210
		// will do? that one works entirely on the device though...
		const output = await this.executeCommandInHostOS(
			'cat /etc/os-release',
			target,
		);
		let match;
		output.split('\n').every(x => {
			if (x.startsWith('VERSION=')) {
				match = x.split('=')[1];
				return false;
			}
			return true;
		});
		return match.replace(/"/g, '');
	}
};
