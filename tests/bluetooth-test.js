/*
 * Copyright 2017 resin.io
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

'use strict'

const path = require('path')
const utils = require('../lib/utils')

module.exports = {
  title: 'General Bluetooth test',
  interactive: true,
  deviceType: {
    type: 'object',
    required: [ 'data' ],
    properties: {
      data: {
        type: 'object',
        required: [ 'connectivity' ],
        properties: {
          connectivity: {
            type: 'object',
            required: [ 'bluetooth' ],
            properties: {
              bluetooth: {
                type: 'boolean',
                const: true
              }
            }
          }
        }
      }
    }
  },
  run: async (test, context, options, components) => {
    const hash = await utils.pushAndWaitRepoToResinDevice({
      path: path.join(options.tmpdir, 'test-bluetooth'),
      url: 'https://github.com/resin-io-playground/test-bluetooth.git',
      uuid: context.uuid,
      key: context.key.privateKeyPath,
      resinio: components.resinio,
      applicationName: options.applicationName
    })

    test.is(await components.resinio.getDeviceCommit(context.uuid), hash)

    test.resolveMatch(utils.runManualTestCase({
      prepare: [ 'Have an activated and visible Bluetooth device around you (i.e your phone\'s bluetooth)' ],
      assert: [
        'Check the device dashboard\'s logs. The last log message should be: TEST PASSED',
        'Restart application if test fails'
      ]
    }), true)
  }
}
