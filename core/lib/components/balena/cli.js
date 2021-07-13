/**
 * # balenaCLI helpers
 *
 * balenaCLI helpers performs frequently executed tasks in order to keep things DRY.
 * For one-off commands, it's recommended to not use the helpers and instead directly use the
 * balenaCLI with the example explained below.
 *
 * @example The core service where the test suites run already has balenaCLI installed. There is no need to
 * initalise the `CLI` class to run/execute any CLI command inside the tests. Instead use
 *
 * ```js
 * const { exec } = require("child_process");
 * await exec(`balena push joystart --source .`)
 * ```
 *
 * To get output from the commands being exectued, use the callback
 *
 * ```js
 * const { exec } = require("child_process");
 * await exec(`balena logs alliance-fleet --service "normandy-sr0"`, (error, stdout, stderr) => {
 *   if (error) {
 *     throw new error
 *   }
 *   console.log(stdout)
 * })
 * ```
 *
 * @module balenaCLI helpers
 */

/* Copyright 2019 balena
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

const Docker = require('dockerode');
const { pathExists, ensureFile } = require('fs-extra');
const { exec, spawn } = require('mz/child_process');
const { basename, dirname, join } = require('path');

module.exports = class CLI {
	constructor(
		logger = { log: console.log, status: console.log, info: console.log },
	) {
		this.logger = logger;
	}

	/**
	 * Preload the image onto the target image
	 *
	 * @param {string} image path to the image
	 * @param {*} options options to be executed with balena preload command
	 *
	 * @category helper
	 */
	async preload(image, options) {
		const socketPath = (await pathExists('/var/run/balena.sock'))
			? '/var/run/balena.sock'
			: '/var/run/docker.sock';

		// We are making use of the docker daemon on the host, so we need to figure out where our image is on the host
		const docker = new Docker({ socketPath });

		const Container = docker.getContainer(
			// Get containerId from inside our container
			(
				await exec(
					'cat /proc/self/cgroup | head -1 | sed -n "s/.*\\([0-9a-z]\\{64\\}\\).*/\\1/p" | tr -d "\n"',
				)
			)[0],
		);
		const Inspect = await Container.inspect();
		const Mount = Inspect.Mounts.find(mount => {
			return mount.Name != null
				? mount.Name.slice(
						mount.Name.length - Inspect.Config.Labels.share.length,
				  ) === Inspect.Config.Labels.share
				: false;
		});

		if (Mount == null || dirname(image) !== Mount.Destination) {
			throw new Error(
				'OS image not found in the expected volume, cannot preload.',
			);
		}

		// We have to deal with the fact that our image exist on the fs the preloader runs in a different
		// path than where our docker daemon runs. Until we fix the issue on the preloader
		await ensureFile(join(Mount.Source, basename(image)));

		this.logger.log('Preloading image');
		await new Promise((resolve, reject) => {
			const output = [];
			const child = spawn(
				'balena',
				[
					`preload ${join(
						Mount.Source,
						basename(image),
					)} --docker ${socketPath} --app ${options.app} --commit ${
						options.commit
					} ${options.pin ? '--pin-device-to-release ' : ''}`,
				],
				{
					stdio: 'pipe',
					shell: true,
				},
			);

			for (const io of ['stdout', 'stderr']) {
				child[io].on('data', data => {
					output.push(data.toString());
				});
			}

			function handleSignal(signal) {
				child.kill(signal);
			}

			process.on('SIGINT', handleSignal);
			process.on('SIGTERM', handleSignal);
			child.on('exit', code => {
				process.off('SIGINT', handleSignal);
				process.off('SIGTERM', handleSignal);
				if (code === 0) {
					resolve();
				} else {
					reject(output.join('\n'));
				}
			});
			child.on('error', err => {
				process.off('SIGINT', handleSignal);
				process.off('SIGTERM', handleSignal);
				reject(err);
			});
		});
	}

	/**
	 * Pushes application to local device locally
	 *
	 * @param {string} target The address/uuid of the device
	 * @param {*} options Options to be executed with balena preload command
	 *
	 * @category helper
	 */
	push(target, options) {
		this.logger.log('Performing local push');
		return exec(
			`balena push ${target} --source ${options.source} --nolive --detached`,
		);
	}

	/**
	 * @param {string} token Session key or API token required for the authentication of balena-cli session
	 *
	 * @category helper
	 */
	loginWithToken(token) {
		this.logger.log('Login CLI');
		return exec(`balena login --token ${token}`);
	}

	/**
	 * @param {string} target The address/UUID of the target device
	 * @param {string} service The container/service for which logs are needed
	 * @returns {string} logs of the service/container running on the target device
	 *
	 * @category helper
	 */
	logs(target, service) {
		return exec(
			`balena logs ${target} ${service ? '--service' + service : ''}`,
		);
	}
};
