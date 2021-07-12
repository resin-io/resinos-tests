/**
 * # Context
 *
 * The context class lets you share instances of objects across different tests. For example, if we
 * made an instance of the worker class in a suite, as above, other tests would not be able to see
 * it. An instance of the context class has a `set()` and a `get()` method, to both add or fetch
 * objects from the context. An example can be seen below:
 *
 * @example
 * ```js
 * const Worker = this.require('common/worker');
 * this.suite.context.set({
 *     worker: new Worker(DEVICE_TYPE_SLUG, this.getLogger()), // Add an instance of worker to context
 * });
 * await this.context.get().worker.flash() // Flash the DUT with the worker instance from context
 * ```
 *
 * The context can be used to share anything between tests - device uuids, app names and so on.
 *
 * @module Context
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

const merge = require('lodash/merge');

module.exports = class Context {
	constructor(context) {
		this.global = context;
		this.ctx = {};
	}

	/**
	 * Method use to add new objects to the context
	 *
	 * @example
	 * this.suite.context.set({
	 *    hup: {
	 *      doHUP: doHUP,
	 *      getOSVersion: getOSVersion,
	 *      initDUT: initDUT,
	 *      runRegistry: runRegistry,
	 *      archiveLogs: archiveLogs,
	 *    }
	 * })
	 *
	 * @param {object} obj
	 * @category helper
	 */
	set(obj) {
		merge(this.ctx, obj);
	}

	/**
	 * Method to fetch objects added to the context from suites and tests.
	 * @category helper
	 */
	get() {
		if (this.global != null) {
			return { ...this.global.get(), ...this.ctx };
		}

		return this.ctx;
	}
};
