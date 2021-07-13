# Tips for writing tests and reference guide

### Worker
The worker class can be used to control the testbot hardware. In the `suite.js` file, you can create an instance of it, and then use its methods to flash the DUT, power it on/off, and set up a network AP for the DUT to connect to. 

```js		
const Worker = this.require('common/worker');
this.suite.context.set({
	worker: new Worker(DEVICE_TYPE_SLUG, this.getLogger()), // Add an instance of worker to the context
});
const Worker = this.require('common/worker');
const worker = new Worker(DEVICE_TYPE_SLUG, this.getLogger())
```

The `this.getLogger()` method gets the logger that can be used from any suite.
Once you have an instance of the`Worker class, you can use its methods like this:

```js
const Worker = this.require('common/worker');
const worker = new Worker(DEVICE_TYPE_SLUG, this.getLogger())

await worker.network(network: {
	ssid: SSID,
	psk: PASSWORD,
	nat: true,
})
await worker.off() // turn off the power to the DUT
await worker.flash() // flash the DUT
await worker.on()
```

Another helpful method of the worker is `executeCommandInHostOs`, which lets you execute command line operations in the host OS of the DUT.
Assuming that the DUT is connected to the AP of the testbot:
```js
const Worker = this.require('common/worker');
const worker = new Worker(DEVICE_TYPE_SLUG, this.getLogger())
await worker.executeCommandInHostOS('cat /etc/hostname', `${UUID}.local`);
```

### Context
The context class lets you share instances of objects across different tests. For example, if we made an instance of the worker class in a suite, as above, other tests would not be able to see it. An instance of the context class has a `set()` and a `get()` method, to both add or fetch objects from the context. An example can be seen below:

```js
const Worker = this.require('common/worker');

this.suite.context.set({
	worker: new Worker(DEVICE_TYPE_SLUG, this.getLogger()), // Add an instance of worker to the context
});

await this.context.get().worker.flash() // flash the DUT with the worker instance thats in the context
```

The context can be used to share anything between tests - device uuids, app names and so on.

### OS helpers
The `BalenaOS` helper class can be used to configure and unpack the OS image that you will use in the test. This allows you to inject config options and network credentials into your image.

```js
const network_conf = {
	ssid: SSID,
	psk: PASSWORD,
	nat: true,
}

const os = new BalenaOS(
	{
		deviceType: DEVICE_TYPE_SLUG,
		network: network_conf,
		configJson: {
			uuid: UUID,
			persistentLogging: true,
		},
	},
	this.getLogger(),
);

await os.fetch();

await os.configure()
```

Alternatively, you can use the CLI to perform these functions - the CLI is imported in the testing environment:
```js
await exec(`balena login --token ${API_KEY}`);

await exec(
	`balena os configure ${PATH_TO_IMAGE}-a ${
	} --config-network wifi --config-wifi-key ${
		PASSWORD
	}  --config-wifi-ssid ${
		SSID
	}  `,
); 
```

### Cloud helpers
The `BalenaSDK` class, defined in [`core/components/balena/sdk`](https://github.com/balena-os/leviathan/blob/master/core/lib/components/balena/sdk.js), contains an instance of the balena sdk, as well as some helper methods. The `balena` attribute of the class contains the sdk, which can then be used as follows:
```js
const Cloud = this.require("components/balena/sdk");

this.suite.context.set({
	cloud: new Balena(`https://api.balena-cloud.com/`, this.getLogger())
});


// login
await this.context
	.get()
	.cloud.balena.auth.loginWithToken(this.suite.options.balena.apiKey);

// create a balena application
await this.context.get().cloud.balena.models.application.create({
	name: `NAME`,
	deviceType: `DEVICE_TYPE`,
	organization: `ORG`,
});

```

Alternatively, Balena SDK is imported into the testing environment by default, so you can create an instance of the SDK and use it without the cloud helpers class:

```js
this.suite.context.set({
	balena: {
		sdk: getSdk({
			apiUrl: 'https://api.balena-cloud.com/',
		}),
		sshKey: { label: LABEL},
	}
});

await this.context.get().balena.sdk.auth.loginWithToken(TOKEN);
await this.context.get().balena.sdk.models.application.create({
	name: APP_NAME,
	deviceType: DEVICE_TYPE_SLUG,
	organization: ORG,
})
```

### Suite node dependencies
Each suite also has its own `package.json` that can be used to list dependencies for any tests in that suite, if those packages aren'y already present within the testing environment.

### Teardowns
You can register functions to be carried out upon "teardown" of the suite or test. These will execute when the test ends, regardless of passing or failing:

```js
this.suite.teardown.register(() => {
	this.log('Worker teardown');
	return this.context.get().worker.teardown();
});
```

If registered in the suite, this will be carried out upon the suite (the collection of tests) ending. You can also add individual teardowns within tests, that will execute when the individual test has ended. In this example here, within the test, we create an applciation, and after the test, we wish to remove that application:

```js
module.exports = {
	title: 'Example',
		tests: [
			{
				title: 'Move device to another application',
				run: async function(test) {
					// create an app
					await this.context.get().balena.sdk.models.application.create({
						name: APP,
						deviceType: DEVICE_TYPE,
						organization: ORG,
					});
					// Register a teardown that will remove the test when the test ends
					this.teardown.register(() => {
						return this.context.get().balena.sdk.models.application.remove(APP);
					});

					// THE REST OF THE TEST CODE
				}
			}
		]
}
```


### Screen capture
If screen capture is supported and appropriate hardware is attached, the video output of the DUT can be captured. For the testbot, this requires a compatible video capture device to be connected, that works with v4L2 and enumerates on the `/dev/video0` interface.

If that is the case, then capture can be started using the `Worker` class `capture()` method, for example:
```js
const Worker = this.require('common/worker');
const worker = new Worker('DEVICE_TYPE_SLUG', this.getLogger())
await worker.capture('start');
```

This will trigger video capture to start, and frames will be saved as `jpg` files in the `/data/capture` directory (which is a shared volume). Capture will continue until stopped with:

```js
await worker.capture('stop');
```
### Sending reports and artifacts back to the client from the testbot
By default, serial logs (given that the hardware is set up correctly), and the logs from the tests will be sent back to the client that started the test, upon the test finishing. Other artifacts can be sent back to the client using the `archiver` method. This method is available within any test:

```js
this.archiver.add(`FILE OR DIRECTORY`)
```

Using this method, at the end of the test, any artifacts added to the archive are compressed and downloaded by the client. These are available in the `workspace/reports` directory at the end of the test.


### What should go in the suite.js of a suite
The recommended pattern is to put the code that gets the device into the state ready for the tests, into the suite. 
Usually, this will include:
- creating an instance of the worker class
- configuring the OS image with the correct configuration and network settings
- setting up the network of the testbot (using `Worker.network()`)
- flashing the DUT (using `Worker.flash()`)
- Checking that the device is online
- listing the tests
