'use strict'
let flatstr = require('flatstr');

function MultiLine (delimiter, cbf, sourceName) {
    this.opt = {
        delimiter: delimiter
    }
    this.sourceName = sourceName;;
    this.lines = [];
    this.consumer = cbf;
    this.tid = 0;
}

MultiLine.prototype.add = function (line, cbf) {
    if (!this.opt.delimiter) {
        return cbf(line);
    }

    if (this.lines.length === 0) {
        this.lines.push(line);
    } else {
        if (this.opt.delimiter.test(line)) {
            // New Multiline
            this.consumer(flatstr(this.lines.join('\n')));
            this.lines.length = 0;
            this.lines.push(line);
            this.consumer = cbf;

            // Handle last logged line after 60 seconds
            this.startTimeout(this);
        } else {
            // Append to Multiline
            this.lines.push(line);
        }
    }
}

MultiLine.prototype.startTimeout = function(that) {
    if (that.timeout) {
        clearTimeout(that.timeout);
    }
    that.timeout = setTimeout(() => {
        if (this.lines.length > 0) {
            that.consumer(flatstr(that.lines.join('\n')));
            that.lines.length = 0;
        }
    }, 60000);
}

module.exports = MultiLine
