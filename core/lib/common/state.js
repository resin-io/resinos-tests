/**
 * # Test State Logging
 *
 * Includes methods to capture different types of message and send them back to the client.
 * 3 types of messages, log, status, info.
 *
 * @module State
 */

module.exports = class State {
	constructor() {
		this._log = [];
		this._status = {};
		this._info = {};
	}

	log(message) {
		const sendObject = {
			type: 'log',
		};

		if (message != null) {
			sendObject.data = message;
			this._log.concat([message]);
		} else {
			sendObject.data = this._log.join('\n');
		}

		process.send(sendObject);
	}

	status(status) {
		const sendObject = {
			type: 'status',
		};

		if (status != null) {
			sendObject.data = status;
			this._status = status;
		} else {
			sendObject.data = this._status;
		}

		process.send(sendObject);
	}

	info(info) {
		const sendObject = {
			type: 'info',
		};

		if (info != null) {
			sendObject.data = info;
			this._info = info;
		} else {
			sendObject.data = this._info;
		}

		process.send(sendObject);
	}
};
