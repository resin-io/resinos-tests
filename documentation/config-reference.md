# Config.js Reference
```js
module.exports = {
    deviceType: '<DUT device type, for example "raspberrypi3-64">',
    suite: `${__dirname}/../suites/os`,
    config: {
        networkWired: false,
        networkWireless: true,
        interactiveTests: false,
        downloadVersion: 'latest',
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
- `downloadVersion`: If you intend to download a balenaOS version for your tests, then you can use this property to specify the balenaOS version semver. The `fetchOS` helper will find and download the balenaOS image. To find the implementation, check https://github.com/balena-os/leviathan/blob/556ae5b52aacc28e72c42ca20413ed0e742126b3/core/lib/components/balena/sdk.js#L557 

*Deprecated Properties*

- `downloadType` configures where the OS will be staged for upload to testbot. `local` is the only available value for it at the moment

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
#### Running 3 test suites using workers objects

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
            downloadVersion: 'latest',
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
        suite: `${__dirname}/../suites/cloud`,
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


#### Running 2 test suites on workers array containing Public URLs

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

`config.js` files are validated using this [schema](https://github.com/balena-os/leviathan/blob/master/client/lib/schemas/multi-client-config.js). Some properties are optional with the ability to add new properties as required. After adding data to config.js, the properties will be available throughout the execution of the test suite.
