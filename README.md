# Leviathan

[![GitHub Issues](https://img.shields.io/github/issues/balena-io/leviathan.svg)](https://github.com/balena-io/leviathan/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/balena-io/leviathan.svg)](https://github.com/balena-io/leviathan/pulls)
[![node](https://img.shields.io/badge/node-v9.0.0-green.svg)](https://nodejs.org/download/release/v9.0.0/)
[![License](https://img.shields.io/badge/license-APACHE%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

> A distributed testing framework for hardware 
## Getting Started

To set up Leviathan both hardware and software need to be configured. If you are setting up your standalone testbot, then please follow the instructions given below carefully before running tests on the Device Under Test (DUT).

### Clone the repository

- Clone this repository with `git clone --recursive` or   
- Run `git clone` and then `git submodule update --init --recursive` to install submodules.
- 
### Prerequisites needed

- Install node and npm in your system. We recommend installing [LTS versions from NVM](https://github.com/nvm-sh/nvm#install--update-script).
- Download the image you want to test on your DUT from [balena.io/os](https://balena.io/os#download).

### Configuration needed

- Start building your standalone testbot by [following the guide](https://github.com/balena-io/testbot/blob/master/documentation/getting-started.md#quick-start-guide-for-testbot). 
- Create your test configuration, by creating a `config.json` file in the `workspace` directory, following instructions mentioned in the [leviathan docs](https://github.com/balena-io/testbot/blob/master/documentation/getting-started.md#run-your-first-test).
- Extract the image you want to test to `./leviathan/workspace` and rename it to `balena.img` 

### Running tests

Run the tests by navigating to the workspace directory and running 

```
./run-tests.sh
```
## Instructions for rig-owners 

To push a new release to balenaCloud, run `npm install` and then push to the balenaCloud application.

```
npm install
balena push <appname>
```

To monitior leviathan tests connected to its pipeline for the rigs, you would need to request Jenkins access.

## Documentation for Leviathan Helpers

Documentation for Leviathan helpers can be found on https://balena-os.github.io/leviathan
To generate the documentation, run the following command from either the root of the repository or the `core` directory. 

```
npm run docs
```

If the docs are generated successfully, you will be getting the success line as:

```
Info: Documentation generated at /path/to/documentation
```

Head there to find the documentation by double clicking the index.html page
## Support

If you're having any problem, please [raise an issue][newissue] on GitHub and the balena team will be happy to help.

## Contribute

- Issue Tracker: [github.com/balena-io/leviathan/issues][issues]
- Source Code: [github.com/balena-io/leviathan][source]

## License

The project is licensed under the Apache 2.0 license.

[issues]: https://github.com/balena-io/leviathan/issues
[newissue]: https://github.com/balena-io/leviathan/issues/new
[source]: https://github.com/balena-io/leviathan
