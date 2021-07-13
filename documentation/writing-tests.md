# Writing new tests in Leviathan

The leviathan framework runs 'suites'. A suite is a collection of tests and a configuration for the environment. The current suite that runs on meta-balena & balena-raspberrypi PRs can be found [here on GitHub](https://github.com/balena-os/meta-balena/tree/master/tests/suites/os).

Leviathan comprises a client, which sends test suites, and a testbot, which will listen for and execute suites. The client is a container that you can run on your laptop, or within an automated workflow to send tests to a testbot.

As you can see from the linked meta-balena directory, we can set up a directory containing a test suite as follows:
- `tests` - Folder containing actual tests
- `conf.js` - File assigning configuration options
- `package.json` - File containing the node dependencies to install for the test suite
- `suite.js` - File where you can select what tests are run as part of the suite, and define your setup code to run before the tests start.

Inside the tests folder, you can add the actual test logic. The recommended approach is to add a folder for each test (with an appropriate name), and inside, keep any assets associated with the test. The test can be written within a file called `index.js`. The tests folder will look something like:

```bash
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
```

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
            run: async function(test) { 
                // put your test within an async function
                // For example, we want to test this addition function
                // let addition = (a,b) =>  a + b

                // Here you can use an assertion to determine the result of the test for example:
                // the `.is` assertion checks if result is === 42
                // test.is(addition(4,5), 42, 'Message');  The test fails with Message!
                
                // the `.is` assertion checks that result === 8
                // test.is(addition(4,4), 8, 'Message');  The test passes!
            },
        },
    ],
};
```
The supported assertions can be found here: https://node-tap.org/docs/api/asserts/

More examples of test logic can be seen here: https://github.com/balena-os/meta-balena/blob/master/tests/suites/os/tests/fingerprint/index.js for a very simple test, and here: https://github.com/balena-os/meta-balena/blob/master/tests/suites/os/tests/connectivity/index.js for more complex tests. 

### Writing a new suite

A new test suite can be created using the folder structure described at the start of this document. A new folder in the suites folder will be the start of the new suite. After you are finished writing the test suite, add the path of the test suite to the `suite` property in your `workspace/config.js`
