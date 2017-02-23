'user strict';
var util = require('util');
var fs = require('fs');
var events = require('events');
var ipAddress = require('ip').address();
var path = require('path');
var winston = require('winston');

// re-usable regular expressions
var startsWithUnderscore = /^_/;
var hasDots = /\./g;

// settings for bulk requests
var MIN_LOGSENE_BULK_SIZE = 200;
var MAX_LOGSENE_BULK_SIZE = 10000;

// upper limit a user could set
var MAX_LOGSENE_BULK_SIZE_BYTES = 20 * 1024 * 1024;
// lower limit a user could set
var MIN_LOGSENE_BULK_SIZE_BYTES = 1024 * 1024;
var MAX_LOGSENE_BUFFER_SIZE = Number(process.env.LOGSENE_BULK_SIZE_BYTES) || 1024 * 1024 * 3; // max 3 MB per http request
// check limits set by users, and adjust if those would lead to problematic settings
if (MAX_LOGSENE_BUFFER_SIZE > MAX_LOGSENE_BULK_SIZE_BYTES) {
    MAX_LOGSENE_BUFFER_SIZE = MAX_LOGSENE_BULK_SIZE_BYTES
}
if (MAX_LOGSENE_BUFFER_SIZE < MIN_LOGSENE_BULK_SIZE_BYTES) {
    MAX_LOGSENE_BUFFER_SIZE = MIN_LOGSENE_BULK_SIZE_BYTES
}
var LOGSENE_BULK_SIZE = Number(process.env.LOGSENE_BULK_SIZE) || 1000; // max 1000 messages per bulk req.
if (LOGSENE_BULK_SIZE > MAX_LOGSENE_BULK_SIZE) {
    LOGSENE_BULK_SIZE = MAX_LOGSENE_BULK_SIZE
}
if (LOGSENE_BULK_SIZE < MIN_LOGSENE_BULK_SIZE) {
    LOGSENE_BULK_SIZE = MIN_LOGSENE_BULK_SIZE
}
var MAX_MESSAGE_FIELD_SIZE = Number(process.env.LOGSENE_MAX_MESSAGE_FIELD_SIZE) || 1024 * 240 // 240 K, leave
var LOG_GLOBAL_PATH = process.env.LOGFILE_PATH || '/logs/fluent-containers.';
var ROTATE_MB = parseInt(process.env.ROTATE_MB) || 50;
var ROTATE_MAX_FILES = parseInt(process.env.ROTATE_MAX_FILES) || 10;

process.setMaxListeners(0);

function fileLogger(token) {
    if (!token) {
        throw new Error('token not specified')
    }

    this.token = token;
    let path = LOG_GLOBAL_PATH + token + '.to.spl';

    this.logger = new winston.Logger({
        transports: [
            new winston.transports.File({
                filename: path,
                zippedArchive: true,
                timestamp: false,
                maxsize: 1024 * 1024 * ROTATE_MB,
                maxFiles: ROTATE_MAX_FILES,
                json: false,
                showLevel: false
            })
        ], exitOnError: false
    })
    this.logger.handleExceptions(new winston.transports.Console({
        humanReadableUnhandledException: true, json: false
    }));

    events.EventEmitter.call(this);
}
util.inherits(fileLogger, events.EventEmitter);

fileLogger.prototype.log = function (level, message, fields, callback) {
    console.log('to file goes: ', message);
    if (fields && fields._type) {
        delete fields._type
    }
    var msg = {
        message: message, severity: level, host: this.hostname, ip: ipAddress
    };
    for (var x in fields) {
        // rename fields for Elasticsearch 2.x
        if (startsWithUnderscore.test(x) || hasDots.test(x)) {
            msg[x.replace(/\./g, '_').replace(/^_+/, '')] = fields[x]
        } else {
            if (!(typeof fields[x] === 'function')) {
                msg[x] = fields[x]
            }
        }
    }
    var _index = this.token;
    if (fields && typeof (fields._index) === 'function') {
        _index = fields._index(msg)
    }
    if (msg.message && Buffer.byteLength(msg.message, 'utf8') > MAX_MESSAGE_FIELD_SIZE) {
        var cutMsg = new Buffer(MAX_MESSAGE_FIELD_SIZE);
        cutMsg.write(msg.message);
        msg.message = cutMsg.toString();
        if (msg.originalLine) {
            // when message is too large and logagent added originalLine,
            // this should be removed to stay under the limits in receiver
            delete msg.originalLine
        }
        msg.logsene_client_warning = 'Warning: message field too large > ' + MAX_MESSAGE_FIELD_SIZE + ' bytes'
        console.log(msg.logsene_client_warning);
    }

    // Own log line
    console.log('logRow: ', msg.message);

    var logRowFormatted = `INDEX: ${_index} | TIMESTAMP: ${msg["@timestamp"].toISOString()} | HOST: ${msg.host} | MESSAGE: ${msg.message} | POD_NAME: ${msg.kubernetes.pod_name} | NAMESPACE: ${msg.kubernetes.namespace} | NAMECONTAIER: ${msg.kubernetes.container_name} | SEVERITY: ${msg.severity}`;
    this.logger.log('info', logRowFormatted);

    this.emit('logged', {msg: msg, _index: _index});
    if (callback) {
        callback(null, msg)
    }
};

module.exports = fileLogger;
