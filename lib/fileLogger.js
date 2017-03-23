'user strict';
var util = require('util');
var fs = require('fs');
var events = require('events');
var ipAddress = require('ip').address();
var rfs    = require('rotating-file-stream');

// re-usable regular expressions
var startsWithUnderscore = /^_/;
var hasDots = /\./g;
var MAX_MESSAGE_FIELD_SIZE = Number(process.env.LOGSENE_MAX_MESSAGE_FIELD_SIZE) || 1024 * 240 // 240 K, leave
var LOG_GLOBAL_PATH = process.env.LOGFILE_PATH || '/logs/fluent-containers.';
var ROTATE_MAX_FILES = parseInt(process.env.ROTATE_MAX_FILES) || 10;
var ROTATE_MB = parseInt(process.env.ROTATE_MB) || 250;

process.setMaxListeners(0);

function pad(num) {
    return (num > 9 ? "" : "0") + num;
}

function getPath(time, index) {
    let time = new Date();
    let yearMonth  = time.getFullYear() + "-" + pad(time.getMonth() + 1);
    let day    = pad(time.getDate());
    let hour   = pad(time.getHours());

    return `${LOG_GLOBAL_PATH}${this.token}.${this.podName}.${yearMonth}-${day}-${hour}-${index}.spl`;
}

function fileLogger(token, podName) {
    if (!token) {
        throw new Error('token not specified')
    }
    if (!podName) {
        throw new Error('podName not specified')
    }

    this.token = token;
    this.podName = podName;

    this.logger = rfs(getPath.bind(this), {
        size:     `${ROTATE_MB}M`,
        interval: '1h',
        compress: 'gzip',
        maxFiles: ROTATE_MAX_FILES
    });

    this.logger.on('error', (err) => {
        console.log('error with logStream: ', err);
    });

    this.logger.on('removed', (filename, number) => {
        console.log('deleting old filename: ', filename, number);
    });

    events.EventEmitter.call(this);
}
util.inherits(fileLogger, events.EventEmitter);

fileLogger.prototype.log = function (level, message, fields, callback) {
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

    var logRowFormatted = `INDEX: ${_index} | TIMESTAMP: ${msg["@timestamp"].toISOString()} | HOST: ${msg.host} | MESSAGE: ${msg.message} | POD_NAME: ${msg.kubernetes.pod_name} | NAMESPACE: ${msg.kubernetes.namespace} | NAMECONTAIER: ${msg.kubernetes.container_name} | SEVERITY: ${msg.severity}`;
    this.logger.write(logRowFormatted);

    this.emit('logged', {msg: msg, _index: _index});
    if (callback) {
        callback(null, msg)
    }
};

module.exports = fileLogger;
