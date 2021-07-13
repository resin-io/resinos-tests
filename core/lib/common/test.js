/**
 * # Test logic for Leviathan tests
 *
 * @module Test
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

const { join } = require('path');

const Archiver = require('./archiver');
const Context = require('./context');

module.exports = class Test {
	constructor(id, suite) {
		this.suite = {
			rootPath: suite.rootPath,
			context: suite.context,
			teardown: {
				register: (fn, bucket) => {
					suite.teardown.register(fn, bucket);
				},
			},
			deviceType: suite.deviceType,
			options: suite.options,
			state: suite.state,
		};

		this.id = id;

		this.teardown = {
			run: async () => {
				await suite.teardown.run(this.id);
			},
			register: fn => {
				this.suite.teardown.register(fn, id);
			},
		};

		this.archiver = new Archiver(id);
		this.context = new Context(this.suite.context);
	}

	log(message) {
		this.suite.state.log(message);
	}

	status(message) {
		this.suite.state.status(message);
	}

	info(message) {
		this.suite.state.info(message);
	}

	// This method allows tests to incldue any module from the core framework
	require(module) {
		return require(join(this.suite.rootPath, module));
	}

	getLogger() {
		return {
			log: this.log.bind(this),
			status: this.status.bind(this),
			info: this.info.bind(this),
		};
	}

	async finish() {
		await this.teardown.run();
	}
};
