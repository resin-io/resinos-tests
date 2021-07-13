# [Deprecated] Quick start guide for leviathan

> This guide has been split into multiple pages in the same folder. You can read more about Leviathan from there. 

This is a quick start guide for using the leviathan remote testing framework, with a testbot. As a prerequisite for this guide, you will have to prepare your testbot, using the following [guide](https://github.com/balena-io/testbot-hardware/blob/master/documentation/getting-started.md).

## Run your first test suite
Once you have set up a testbot, you can run your first tests.

- Ensure you have `docker` installed on your machine.
- Clone and setup the [leviathan](https://github.com/balena-io/leviathan) with instructions mentioned in the [README](https://github.com/balena-os/leviathan/blob/master/README.md).
- Navigate to the `workspace` directory in the project using `cd workspace/`
- Create a `config.js` file in the `workspace` directory using the following template:

```js
module.exports = {
    deviceType: '<DUT device type, for example "raspberrypi3-64">',
    suite: `${__dirname}/../suites/os`,
    config: {
        networkWired: false,
        networkWireless: true,
        interactiveTests: false,
        balenaApiKey: process.env.BALENACLOUD_API_KEY,
        balenaApiUrl: 'balena-cloud.com',
        organization: process.env.BALENACLOUD_ORG
    },
    image: `${__dirname}/balena.img.gz`,
    workers: ['http://<short UUID of your testbot in balenaCloud>.local'],
};
```

- Run the `run-tests.sh` script from the `workspace` directory and watch the logs. At the end of the run, reports and logs about the test will be stored in `workspace/reports` directory.

Information on properties in `config.js`:

- `deviceType` is the Device Under Test (DUT) attached to the testbot. Example: Raspberrypi3 64-bit device, the `deviceType` property needs to be `raspberrypi3-64`.
- `suite` is the absolute path to the test suite directory that you want to execute. The path after `__dirname` in the config is a path relative to the workspace directory.
- `networkWired` and `networkWireless` properties for configuration of Network Manager. Used to configure the right mode of connection for the DUT to connect to the Access Point (AP) created by the testbot.
- `interactiveTests` If it's a semi-auto test or not.
- `balenaApiKey` is the balenaCloud API key used when running the release suite. Ideally, you can add it as an environment variable and reference it with `process.env.BALENACLOUD_API_KEY`.
- `balenaApiUrl` is the balenaCloud environment you are targetting for your test suite. Production is `'balena-cloud.com'` and staging is `'balena-staging.com'`.
- `organization` is the balenaCloud organizations where test applications are created. Ideally, you can add it as an environment variable and reference it with `process.env.BALENACLOUD_ORG`.
- `image` is the absolute path to the balenaOS image that is flashed onto the Device Under Test (DUT). The image should be kept under the `workspace` directory. The path after `__dirname` in the config is a path relative to the workspace directory. Make sure to rename the image to balena.img. If you provide `balena.img` as your balenaOS image, then Leviathan will compress it for you in `gz` format. We recommend compressing beforehand, as it saves time.  
- `workers` is the property where we specify precisely on which testbots the test suites will be executed on. You can specify this in multiple ways as per the requirement. 

*Deprecated Properties*

- - `downloadType` configures where the OS will be staged for upload to testbot. `local` is the only available value for it at the moment

### Different `workers` configurations available

1. **Using <UUID>.local** - The last line in the `config.json` above assumes you are on the same network with the testbot. Note: that on some Linux distributions, the container will not be able to resolve `.local` addresses. If you face this problem until we find a proper solution, you can replace this address with your device's local IP (copy it from the device summary page on balenaCloud).

```js
workers: ['http://<short UUID of your testbot in balenaCloud>.local'],
```

2. **Using public URLs** - If the testbot is not on the same network as you, please enable the public URL in balenaCloud and use that in the `workers` array. If multiple URLs are provided, then each testbot in the array would be running the same test suite listed in the `config.js`. Queueing support is WIP, where two or more test suites can be run on the same worker using public URLs.

```js
workers: ['Public URL of your testbot'],
```

3. **Using a balenaCloud application** - Using a workers object, you can specify a balenaCloud application containing testbots (connected to DUTs) and a balenaCloud API key. All testbots inside that balenaCloud application can be used to run test suites. These testbots need to be online and contain a `DUT` tag with the value being the `deviceType` to be selected for testing. Leviathan looks for all devices inside that balenaCloud application with `DUT` tag and pushes test jobs to available testbots. This method is often used for testbot rigs in production use cases, with several testbots available as workers to run the tests. Multiple tests can be queued and made to run in parallel on compatible workers.

```js
workers: {
   balenaApplication: process.env.BALENACLOUD_APPLICATION_NAME,
   apiKey: process.env.BALENACLOUD_API_KEY
}
```

### `config.js` Examples

Following is an exhaustive list of config.js examples which can be used for reference

<details>
  <summary>3 test suites using workers objects (Click to expand)</summary>

```js
module.exports = [{
        deviceType: "raspberrypi3",
        suite: `${__dirname}/../suites/os`,
        config: {
            networkWired: false,
            networkWireless: true,
            interactiveTests: false,
            balenaApiKey: process.env.BALENACLOUD_API_KEY,
            balenaApiUrl: 'balena-cloud.com',
            organization: process.env.BALENACLOUD_ORG,
        },
        image: `${__dirname}/balena.img.gz`,
        workers: {
            balenaApplication: 'testbot-vipul',
            apiKey: "blah-blah-blah",
        },
    },
    {
        deviceType: "raspberrypi3",
        suite: `${__dirname}/../suites/hup`,
        config: {
            networkWired: false,
            networkWireless: true,
            interactiveTests: false,
            balenaApiKey: process.env.BALENACLOUD_API_KEY,
            balenaApiUrl: 'balena-cloud.com',
            organization: process.env.BALENACLOUD_ORG
        },
        image: `${__dirname}/balena.img.gz`,
        workers: {
            balenaApplication: 'testbot-vipul',
            apiKey: "blah-blah-blah",
        }
    },
    {
        deviceType: "raspberrypi3",
        suite: `${__dirname}/../suites/release`,
        config: {
            networkWired: false,
            networkWireless: true,
            interactiveTests: false,
            balenaApiKey: process.env.BALENACLOUD_API_KEY,
            balenaApiUrl: 'balena-cloud.com',
            organization: process.env.BALENACLOUD_ORG
        },
        image: `${__dirname}/balena.img.gz`,
        workers: {
            balenaApplication: 'testbot-vipul',
            apiKey: "blah-blah-blah",
        }
    }]
```
</details>

<details>
  <summary>2 test suites on workers array containing Public URLs (Click to expand)</summary>

```js
module.exports = [{
        deviceType: "raspberrypi3",
        suite: `${__dirname}/../suites/os`,
        config: {
            networkWired: false,
            networkWireless: true,
            interactiveTests: false,
            balenaApiKey: process.env.BALENACLOUD_API_KEY,
            balenaApiUrl: 'balena-cloud.com',
            organization: process.env.BALENACLOUD_ORG,
        },
        image: `${__dirname}/balena.img.gz`,
        workers: ['https://6ad523252f8288bdff15bda320485237.balena-devices.com/']
    },
    {
        deviceType: "raspberrypi3",
        suite: `${__dirname}/../suites/hup`,
        config: {
            networkWired: false,
            networkWireless: true,
            interactiveTests: false,
            balenaApiKey: process.env.BALENACLOUD_API_KEY,
            balenaApiUrl: 'balena-cloud.com',
            organization: process.env.BALENACLOUD_ORG
        },
        image: `${__dirname}/balena.img.gz`,
        workers: ['https://123213bda32048sgd5dfw223423723324.balena-devices.com/']
    }]
```
</details>

`config.js` files are validated using this [schema](https://github.com/balena-os/leviathan/blob/master/client/lib/schemas/multi-client-config.js). Some properties are optional with the ability to add new properties as required. After adding data to config.js, the properties will be available throughout the execution of the test suite.

## Writing new tests in Leviathan

The leviathan framework runs 'suites'. A suite is a collection of tests and a configuration for the environment. The current suite that runs on meta-balena & balena-raspberrypi PRs can be found [here on GitHub](https://github.com/balena-os/meta-balena/tree/master/tests/suites/os).

Leviathan comprises a client, which sends test suites, and a testbot, which will listen for and execute suites. The client is a container that you can run on your laptop, or within an automated workflow to send tests to a testbot.

As you can see from the linked meta-balena directory, we can set up a directory containing a test suite as follows:
- `tests` - Folder containing actual tests
- `conf.js` - File assigning configuration options
- `package.json` - File containing the node dependencies to install for the test suite
- `suite.js` - File where you can select what tests are run as part of the suite, and define your setup code to run before the tests start.

Inside the tests folder, you can add the actual test logic. The recommended approach is to add a folder for each test (with an appropriate name), and inside, keep any assets associated with the test. The test can be written within a file called `index.js`. The tests folder will look something like:

- tests
    - test-1
        - assets
        - index.js - the test is written in this file
    - test-2
        - assets
        - index.js
    - .
    - .
    - etc 


## How do I add a new test?

To add a new test, you could either create a new suite, or a add a test to an existing suite.
For reference, an old PR [adding a test](https://github.com/balena-os/leviathan/commit/0ec26632881ef2c262e67d30ebccaaf0611b01ad#diff-df7b8717d54947445c5900174e15e5cf) to the OS test suite in Leviathan.

### Adding a test/tests to an existing suite

1. Navigate to the suite folder where the test needs to be added (for example https://github.com/balena-os/meta-balena/tree/master/tests/suites/os). 
2. Navigate to the `/tests` directory inside that suite.
3. Create a new directory `<MY_NEw_TEST>`, with an appropriate name for your test.
4. Inside this new directory, create an `index.js` file
5. Inside `index.js`, test logic lives (details about writing the test logic are explained in the next section)
6. Going back to the suite directory, navigate to `suite.js`
7. Inside `suite.js`, towards the botton of the file, there will be an array named `tests`, add your new test to it like this:
```js
tests: [
	'./tests/fingerprint',
	'./tests/led',
	'./tests/config-json',
	'./tests/connectivity',
	'./tests/<MY_NEw_TEST>',
	],
```
8. Ensure that any new dependencies used in your test are added to the `package.json`


### Writing the test logic

Tests must be written in node, and are ingested by a framework called [node-tap](https://node-tap.org/docs/api/asserts/). 
To write a new test, inside `tests/<MY_NEw_TEST>/index.js` , we can use the following template (note that this file can contain a set of tests - you just have to have multiple objects in the `tests` array!)

Each test is an asychnronous function, assigned to the `run` attribute of a test.

```js
'use strict';

module.exports = {
	title: 'Your name for the collection of tests in this file goes here',
	tests: [
		{
			title: 'The test name goes here',
			run: async function(test) { //put your test within an async function!
				// Here you can write the test logic for example
				// let result = 4 + 4  // this is equal to 8

				// Here you can use an assertion to determine the result of the test for example:
				// test.is(result, 4, 'Message'); // the .is assertion checks that result === 4 as it isn't, this test will fail!
				// test.is(result, 8, 'Message'); // the .is assertion checks that result === 8 as it is, this test will pass!
				// the supported assertions can be seen here: https://node-tap.org/docs/api/asserts/
			},
		},
	],
};
```

More examples of test logic can be seen here: https://github.com/balena-os/leviathan/blob/master/suites/os/tests/fingerprint/index.js for a very simple test, and here: https://github.com/balena-os/leviathan/blob/master/suites/os/tests/connectivity.js for more complex tests. 

One of the most useful methods to control the DUT, is to use:
```js
await this.context.get().worker.executeCommandInHostOS('command line command',this.context.get().link);
```
This will execute the given command in the HostOS of the DUT. 

This section will be expanded as we discover more...

### Writing a new suite

A new test suite can be created if desired. For unmanaged OS tests, I would recommend just adding tests to the existing OS test suite - however, if a new suite is desired, one can be created using the folder structure described at the start of this document. 

## Tips

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
