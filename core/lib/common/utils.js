/**
 * # Utility helpers
 *
 * The module contains helpers to better write tests.
 *
 * @module Leviathan Utility helpers
 */

/*
 * Copyright 2017 balena
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

require('any-promise/register/bluebird');

const isEmpty = require('lodash/isEmpty');
const forEach = require('lodash/forEach');
const noop = require('lodash/noop');
const assignIn = require('lodash/assignIn');
const assign = require('lodash/assign');
const replace = require('lodash/replace');
const trim = require('lodash/trim');

const Bluebird = require('bluebird');
const exec = Bluebird.promisify(require('child_process').exec);
const { fs } = require('mz');
const inquirer = require('inquirer');
const keygen = Bluebird.promisify(require('ssh-keygen'));
const path = require('path');
const repl = require('repl');
const SSH = require('node-ssh');

const printInstructionsSet = (title, instructions) => {
	if (isEmpty(instructions)) {
		return;
	}

	console.log(`==== ${title}`);

	forEach(instructions, instruction => {
		console.log(`- ${instruction}`);
	});
};

const getSSHClientDisposer = config => {
	const createSSHClient = conf => {
		return Bluebird.resolve(
			new SSH().connect(
				assignIn(
					{
						agent: process.env.SSH_AUTH_SOCK,
						keepaliveInterval: 20000,
					},
					conf,
				),
			),
		);
	};

	return createSSHClient(config).disposer(client => {
		client.dispose();
	});
};

module.exports = {
	/**
	 * This is the base hostOS execution command used by many other functions like `executeCommandIntoHostOs` to
	 * execute commands on the DUT being passed through SSH.
	 *
	 * @param {string} command The command to be executed over SSH
	 * @param {*} config
	 *
	 * @category helper
	 */
	executeCommandOverSSH: async (command, config) => {
		return Bluebird.using(getSSHClientDisposer(config), client => {
			return new Bluebird(async (resolve, reject) => {
				client.connection.on('error', err => {
					reject(err);
				});
				resolve(
					await client.exec(command, [], {
						stream: 'both',
					}),
				);
			});
		});
	},

	/**
	 * @param {string} promise The command you need to wait for
	 * @param {boolean} rejectionFail Whether the `waitUntil()` function error out, if a iteration fails once. Defaults to `false`, which results in `waitUntil()` not failing as it iterates and wait for the condition to satisfy.
	 * @param {number} _times Specify how many times should the command be executed
	 * @param {number} _delay Specify the delay between each iteration of the command execution
	 * @throws error on first iteration if`rejectionFail` is true. Otherwise throws error after iterating through the specified `_times` parameter
	 *
	 * @category helper
	 */
	waitUntil: async (
		promise,
		rejectionFail = false,
		_times = 20,
		_delay = 30000,
	) => {
		const _waitUntil = async timesR => {
			if (timesR === 0) {
				throw new Error(`Condition ${promise} timed out`);
			}

			try {
				if (await promise()) {
					return;
				}
			} catch (error) {
				if (rejectionFail) {
					throw error;
				}
			}

			await Bluebird.delay(_delay);

			return _waitUntil(timesR - 1);
		};

		await _waitUntil(_times);
	},
	runManualTestCase: async testCase => {
		// Some padding space to make it easier to the eye
		await Bluebird.delay(50);
		printInstructionsSet('PREPARE', testCase.prepare);
		printInstructionsSet('DO', testCase.do);
		printInstructionsSet('ASSERT', testCase.assert);
		printInstructionsSet('CLEANUP', testCase.cleanup);

		return (
			await inquirer.prompt([
				{
					type: 'confirm',
					name: 'result',
					message: 'Did the test pass?',
					default: false,
				},
			])
		).result;
	},
	getDeviceUptime: async connection => {
		const start = process.hrtime()[0];
		const uptime = await connection("cut -d ' ' -f 1 /proc/uptime");

		return Number(uptime) - (start - process.hrtime()[0]);
	},
	clearHandlers: events => {
		forEach(events, event => {
			process.on(event, noop);
		});
	},
	repl: (context, options) => {
		return new Bluebird((resolve, _reject) => {
			const prompt = repl.start({
				prompt: `${options.name} > `,
				useGlobal: true,
				terminal: true,
			});

			assign(prompt.context, context);

			prompt.on('exit', () => {
				resolve();
			});
		});
	},
	searchAndReplace: async (filePath, regex, replacer) => {
		const content = await fs.readFile(filePath, 'utf-8');
		return fs.writeFile(filePath, replace(content, regex, replacer), 'utf-8');
	},
	createSSHKey: keyPath => {
		return fs
			.access(path.dirname(keyPath))
			.then(async () => {
				const keys = await keygen({
					location: keyPath,
				});
				await exec('ssh-add -D');
				await exec(`ssh-add ${keyPath}`);
				return keys;
			})
			.get('pubKey')
			.then(trim);
	},
	getFilesFromDirectory(basePath, ignore = []) {
		async function _recursive(_basePath, _ignore = []) {
			let files = [];
			const entries = await fs.readdir(_basePath);

			for (const entry of entries) {
				if (_ignore.includes(entry)) {
					continue;
				}

				const stat = await fs.stat(path.join(_basePath, entry));

				if (stat.isFile()) {
					files.push(path.join(_basePath, entry));
				}

				if (stat.isDirectory()) {
					files = files.concat(
						await _recursive(path.join(_basePath, entry), _ignore),
					);
				}
			}

			return files;
		}

		return _recursive(basePath, ignore);
	},
};
