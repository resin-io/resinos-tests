# Quick start 

This is a quick start guide for using the leviathan remote testing framework, with a testbot. As a prerequisite for this guide, you will have to prepare your testbot, using the following [guide](https://github.com/balena-io/testbot-hardware/blob/master/documentation/getting-started.md).

## Run your first test suite
Once you have set up a testbot, you can run your first tests.

- Ensure you have `docker` and node installed on your machine.
- Clone the [leviathan](https://github.com/balena-io/leviathan) repository and then `git submodule update --init --recursive` to install submodules.
- Navigate to the `workspace` directory in the project using `cd workspace/`
- Create a `config.js` file in the `workspace` directory using the following template:

```js
module.exports = {
    deviceType: '<DUT device type, for example "raspberrypi3-64">',
    suite: `${__dirname}/../suites/os`,
    config: {
        networkWired: false,
        networkWireless: true,
        downloadVersion: 'latest',
        interactiveTests: false,
        balenaApiKey: process.env.BALENACLOUD_API_KEY,
        balenaApiUrl: 'balena-cloud.com',
        organization: process.env.BALENACLOUD_ORG
    },
    image: `${__dirname}/balena.img`,
    workers: ['http://<short UUID of your testbot in balenaCloud>.local'],
};
```

- The tests in Leviathan are deprecated, hence use the tests from [meta-balena](https://github.com/balena-os/meta-balena/tree/master/tests/suites) instead. OS test suite is recommended as it works with the least configuration.
- If you are running the OS test suite, downloading the image you want to test on your DUT from [balena.io/os](balena.io/os).Extract the image to `./leviathan/workspace` and rename it to `balena.img`. 
- Run the `run-tests.sh` script from the `workspace` directory and watch the logs. 
- At the end of the run, reports and logs about the test will be stored in `workspace/reports` directory.
