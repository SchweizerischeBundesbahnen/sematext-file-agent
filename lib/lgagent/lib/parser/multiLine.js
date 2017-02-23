'use strict'
/*
 * See the NOTICE.txt file distributed with this work for additional information
 * regarding copyright ownership.
 * Sematext licenses logagent-js to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var flatstr = require('flatstr')
var Evt = require('./timerEvent.js')

var timer = new Evt({
    interval: Number(process.env.LOGAGENT_MULTILINE_TIMEOUT_MS) || 250,
    event: 'timeOut'
})
timer.start()

function MultiLine (delimiter, cbf, logme) {
    console.log('Created me for: ', delimiter)
    this.opt = {
        delimiter: delimiter
    }
    this.logMe = logme;
    this.lines = []
    this.state = 0
    this.consumer = cbf
    this.tid = 0
    if (delimiter) {
        timer.on('timeOut', this.lineTimeout.bind(this))
    }
}

MultiLine.prototype.lineTimeout = function () {
    if (this.lines.length > 0) {
        if (this.logMe) {
            console.log( 'lineTimeout Reached', this.lines.join('\n'));
        }
        this.consumer(flatstr(this.lines.join('\n')))
        this.lines.length = 0
        this.state = 0
    }
}

MultiLine.prototype.add = function (line, cbf) {
    if (!this.opt.delimiter) {
        return cbf(line)
    }

    if (this.lines.length === 0) {
        this.lines.push(line)
    } else { // reading in block
        if (this.opt.delimiter.test(line)) {
            if (this.logMe) {
                console.log('line is start: ', line);
            }
            this.consumer(flatstr(this.lines.join('\n')))
            this.lines.length = 0
            this.lines.push(line)
            this.consumer = cbf
        } else {
            if (this.logMe) {
                console.log('line is multi: ', line);
            }
            this.lines.push(line)
        }
    }
}

module.exports = MultiLine