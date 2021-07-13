/**
 * # Send reports/artifacts from testbot back to client
 *
 * By default, serial logs (given that the hardware is set up correctly), and the
 * logs from the tests will be sent back to the client that started the test, upon
 * the test finishing. Other artifacts can be sent back to the client using the
 * `archiver` method. This method is available within any test:
 *
 * @example
 * ```js
 * this.archiver.add(`path/of/FILE`)
 * ```
 *
 * Using this method, at the end of the test, any artifacts added to the archive are compressed and
 * downloaded by the client. These are available in the `workspace/reports` directory at the end of
 * the test. This can also be helpful when storing diagigggddddd
 *
 * @module Archiver
 */

/*
 * Copyright 2019 balena
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

const config = require('config');
const { createWriteStream } = require('fs');
const { copy, ensureDir } = require('fs-extra');
const { basename, join } = require('path');

module.exports = class Archiver {
	constructor(id) {
		this.location = join(config.get('leviathan.artifacts'), id);
	}

	async add(artifactPath) {
		const archivePath = join(this.location, basename(artifactPath));

		await ensureDir(this.location);
		await copy(artifactPath, archivePath);
	}

	async getStream(artifactPath) {
		const archivePath = join(this.location, basename(artifactPath));

		await ensureDir(this.location);
		return createWriteStream(archivePath);
	}
};
