var rfs    = require('rotating-file-stream');

function pad(num) {
    return (num > 9 ? "" : "0") + num;
}

function getPath(time, index) {
    var time = new Date();
    var month  = time.getFullYear() + "-" + pad(time.getMonth() + 1);
    var day    = pad(time.getDate());
    var hour   = pad(time.getHours());

    return `glob.${this.token}.${this.podName}.${month}-${day}-${hour}-${index}.spl`;
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
        size:     `1M`,
        interval: '10s',
        compress: 'gzip',
        maxFiles: 2
    });

    this.logger.on('error', (err) => {
        console.log('error with logstream: ', err);
    });

    this.logger.on('removed', (filename, number) => {
        console.log('deleting old filename: ', filename, number);
    });

    return this.logger;
}

logger = fileLogger("token", "name");

for (var i =0; i < 1000000; i++) {
    logger.write('TEST' + i);
}