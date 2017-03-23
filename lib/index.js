#!/bin/sh
':' // ; export MAX_MEM="--max-old-space-size=512"; exec "$(command -v node || command -v nodejs)" "${NODE_OPTIONS:-$MAX_MEM}" "$0" "$@"

/*
 * @copyright Copyright (c) Sematext Group, Inc. - All Rights Reserved
 *
 * @licence SPM for Docker is free-to-use, proprietary software.
 * THIS IS PROPRIETARY SOURCE CODE OF Sematext Group, Inc. (Sematext)
 * This source code may not be copied, reverse engineered, or altered for any purpose.
 * This source code is to be used exclusively by users and customers of Sematext.
 * Please see the full license (found in LICENSE in this distribution) for details on its license and the licenses of its dependencies.
 */
var SpmAgent = require('spm-agent')
var config = SpmAgent.Config
config.useLinuxAgent = true
// starts to capture docker logs
var dockerLogsene = null
var startDockerLogs = process.env.DISABLE_DOCKER_LOGS ? false : true
// check system date to avoid producing logs in the past.
// we have seen systems reporting 1970
if (new Date().getYear() < 116) {
  console.log('Invalid system date ' + new Date())
  process.exit(100)
}

function DockerMonitor () {
  if (process.env.SPM_TOKEN && !SpmAgent.Config.tokens.spm) {
    SpmAgent.Config.tokens.spm = process.env.SPM_TOKEN
  }
  if (process.argv[2] && process.argv[2].length > 30) {
    SpmAgent.Config.tokens.spm = process.argv[2]
  }
  var njsAgent = new SpmAgent()
  njsAgent.on('metrics', console.log)
  var agentsToLoad = [
    './dockerAgent',
    'spm-agent-os'
  ]
  agentsToLoad.forEach(function (a) {
    try {
      var Monitor = require(a)
      njsAgent.createAgent(new Monitor())
    } catch (err) {
      error('Error loading agent ' + a + ' ' + err.stack)
      error(err)
      SpmAgent.Logger.error('ERROR - Error loading agent ' + a + ' ' + err)
    }
  })
  return njsAgent
}
var tokens = 0
if (process.env.SPM_TOKEN || process.argv[2] && process.argv[2].length > 30) {
  tokens++
  DockerMonitor()
} else {
  info('No metrics will be collected: missing parameter -e SPM_TOKEN=YOUR_SPM_TOKEN')
}
// Always do docker logs
tokens++
if (startDockerLogs) {
    dockerLogsene = require('./dockerLogseneToFile')
}
if (tokens === 0) {
  info('No containers to log found. Seems like a wrong config?');
}
var errorCounter = 0
process.on('uncaughtException', function (err) {
  error('Please contact support@sematext.com to report the error:')
  error('UncaughtException:' + err + '\n  ' + err.stack)
  errorCounter++
  if (errorCounter > 1) {
    // console.log('more than 50 uncaught errors -> exit.')
    process.exit(2)
  }
//
})

function error (m) {
  log('ERROR', m)
}
function info (m) {
  log('INFO', m)
}
function log (level, message) {
  var msg = (new Date()).toISOString() + ' - ' + level + ' - ' + message
  if (level === 'ERROR') {
    console.error(msg)
  } else {
    console.log(msg)
  }
}
