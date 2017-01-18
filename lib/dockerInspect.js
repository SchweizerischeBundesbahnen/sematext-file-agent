#!/usr/bin/env node
var Docker = require('dockerode')
var docker = new Docker()
var minimatch = require('minimatch')
var dockerInfo = {}
var tagIds = []
if (process.env.TAGGING_LABELS) {
    tagIds = process.env.TAGGING_LABELS.split(',')
}

docker.info(function dockerInfoHandler(err, data) {
    if (err) {
        console.error(err)
    }
    if (data) {
        dockerInfo = data
        // SPM_MONITOR_TAGS is evaluated by spm-sender before it sends metrics to SPM
        if (!process.env.SPM_MONITOR_TAGS) {
            if (data.Labels && data.Labels.length > 0) {
                process.env.SPM_MONITOR_TAGS = data.Labels.join(',')
            }
        } else {
            if (data.Labels && data.Labels.length > 0) {
                process.env.SPM_MONITOR_TAGS = process.env.SPM_MONITOR_TAGS + ',' + data.Labels.join(',')
            }
        }
    }
})

function getEnvVar(name, list) {
    if (!list) {
        return null
    }
    if (!(list instanceof Array)) {
        var keys = Object.keys(list)
        for (var k = 0; k < keys.length; k++) {
            if (keys[k].indexOf(name) > -1) {
                return list[keys[k]].trim()
            }
        }
    } else {
        for (var i = 0; i < list.length; i++) {
            if (list[i].indexOf(name) > -1) {
                var rv = list[i].split('=')
                if (rv && rv.length > 1 && rv[1]) {
                    rv = rv[1]
                    return rv
                }
            }
        }
    }
    return null
}

function getValue(name, list, info) {
    if (!list) {
        return null
    }
    if (!(list instanceof Array)) {
        var keys = Object.keys(list)
        for (var k = 0; k < keys.length; k++) {
            if (minimatch(keys[k], name)) {
                if (!info.tags) {
                    info.tags = {}
                }
                info.tags[keys[k]] = list[keys[k]]
                info.tags
            }
        }
    } else {
        for (var i = 0; i < list.length; i++) {
            if (minimatch(list[i], name)) {
                var value = list[i].split('=')
                if (value.length > 1) {
                    if (!info.tags) {
                        info.tags = {}
                    }
                    info.tags[value[0]] = value[1]
                }
            }
        }
    }

    return null
}

function extractLoggingTags(labels, env, info) {
    // console.log(info)
    if (tagIds.length > 0) {
        for (var i = 0; i < tagIds.length; i++) {
            getValue(tagIds[i] + '*', labels, info)
            getValue(tagIds[i] + '*', env, info)
            getValue(tagIds[i] + '*', dockerInfo.Labels, info)
        }
    }
}

function getLogseneToken(err, info) {
    if (!err) {
        extractLoggingTags(info.Config.Labels, info.Config.Env, info)
        var splunkIndex = getEnvVar('SPLUNK_INDEX', info.Config.Env);
        if (splunkIndex) {
            info.LOGSENE_ENABLED = true
            info.SPLUNK_INDEX = splunkIndex;
            console.log('Container ' + info.Id + ' - ' + info.Name + ' - Index: ' + splunkIndex);
        } else {
            info.LOGSENE_ENABLED = false;
        }
    }
    if (info) {
        info.dockerInfo = dockerInfo
        this.callback(null, info)
    } else {
        this.callback(null, {
            SPLUNK_INDEX: process.env.SPLUNK_INDEX, id: this.container
        })
    }
}

function getLogseneTokenForContainer(id, cb) {
    docker.getContainer(id).inspect(getLogseneToken.bind({
        callback: cb, container: id
    }))
}

module.exports = getLogseneTokenForContainer
