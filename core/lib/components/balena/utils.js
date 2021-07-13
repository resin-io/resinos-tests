/**
 * # Helpers to test balena git workflows
 *
 * git workflows are considered legacy and not tested.
 *
 * @module balena git helpers
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

const flow = require('lodash/fp/flow');
const zip = require('lodash/fp/zip');
const filter = require('lodash/fp/filter');
const every = require('lodash/fp/every');

const trim = require('lodash/trim');
const assign = require('lodash/assign');
const isEmpty = require('lodash/isEmpty');
const isEqual = require('lodash/isEqual');
const isNumber = require('lodash/isNumber');

const Bluebird = require('bluebird');
const fse = require('fs-extra');
const git = require('simple-git/promise');
const { join } = require('path');

const GIT_SSH_COMMAND =
	'ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no';

const waitProgressCompletion = async (
	stepper,
	terminate,
	_times = 20,
	_delay = 30000,
) => {
	const _waitProgressCompletion = async timesR => {
		if (timesR === 0) {
			throw new Error(`Progress for ${stepper} has timed out`);
		}
		const result = await terminate();

		if (result) {
			return;
		}

		const initial = await Bluebird.method(stepper)().delay(_delay);
		const step = await Bluebird.method(stepper)().delay(_delay);

		if (
			flow([
				zip,
				filter(pair => {
					return !isEqual(pair, [null, null]);
				}),
				every(pair => {
					return (
						isNumber(pair[1]) && isNumber(pair[0]) && pair[1] - pair[0] === 0
					);
				}),
			])(initial, step)
		) {
			return _waitProgressCompletion(timesR - 1);
		}

		return _waitProgressCompletion(timesR);
	};

	await _waitProgressCompletion(_times);
};

module.exports = class DeviceApplicationActionable {
	constructor() {
		this.chain = {};
		this.setChain();
	}

	async init({ url, sdk, path }) {
		this.sdk = sdk;
		this.url = url;
		this.path = join(
			path,
			Math.random()
				.toString(36)
				.substring(2, 10),
		);

		return this.setChain({ clone: this.clone.bind(this) });
	}

	getPushedCommit() {
		return this.pushedCommit;
	}

	setChain(actions) {
		assign(
			this.chain,
			{ init: this.init.bind(this) },
			{ getChain: this.getChain.bind(this) },
			{ getPushedCommit: this.getPushedCommit.bind(this) },
			actions,
		);

		return this.getChain();
	}

	getChain() {
		return this.chain;
	}

	async clone() {
		await fse.remove(this.path);
		await git().clone(this.url, this.path);

		await git(this.path).addConfig('user.name', 'Leviathan');
		await git(this.path).addConfig('user.email', 'leviathan@balena.io');

		return this.setChain({
			push: this.push.bind(this),
			commit: this.commit.bind(this),
			emptyCommit: this.emptyCommit.bind(this),
		});
	}

	async push(branch, remote) {
		if (remote != null) {
			if (
				(await git(this.path).getRemotes()).some(r => {
					return r.name === remote.name;
				})
			) {
				await git(this.path).removeRemote(remote.name);
			}
			await git(this.path).addRemote(remote.name, remote.url);
			this.remote = remote;
		} else if (this.remote == null) {
			throw new Error('No remote to push to');
		}

		await git(this.path)
			.env({
				SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
				GIT_SSH_COMMAND,
			})
			.push(this.remote.name, branch.name, {
				'--force': null,
			});

		this.pushedCommit = trim(await git(this.path).revparse([branch.name]));

		return this.setChain({
			waitServiceProperties: this.waitServiceProperties.bind(this),
			push: this.push.bind(this),
			getPushedCommit: this.getPushedCommit.bind(this),
		});
	}

	async commit(modifier) {
		await modifier(this.path);
		await git(this.path).add('./*');
		await git(this.path).commit('mod');

		return this.setChain({
			push: this.push.bind(this),
			commit: this.commit.bind(this),
			emptyCommit: this.emptyCommit.bind(this),
		});
	}

	async emptyCommit() {
		await git(this.path).commit('empty', {
			'--allow-empty': null,
		});

		return this.setChain({
			push: this.push.bind(this),
			commit: this.commit.bind(this),
			emptyCommit: this.emptyCommit.bind(this),
		});
	}

	async waitServiceProperties(properties, uuid) {
		await this.sdk.triggerDeviceUpdate(uuid);

		await waitProgressCompletion(
			() => {
				return this.sdk.getAllServicesProperties(uuid, ['download_progress']);
			},
			async () => {
				const services = await this.sdk.getAllServicesProperties(
					uuid,
					Object.keys(properties),
				);

				if (isEmpty(services)) {
					return false;
				}

				return every(properties, services);
			},
		);

		return this.setChain({
			waitServiceProperties: this.waitServiceProperties.bind(this),
			push: this.push.bind(this),
			commit: this.commit.bind(this),
			emptyCommit: this.emptyCommit.bind(this),
		});
	}
};
