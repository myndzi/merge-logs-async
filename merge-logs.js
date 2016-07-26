'use strict';

var Promise = require('bluebird'),
    split = require('binary-split-streams2');

var fs = Promise.promisifyAll(require('fs'), { suffix: '$' }),
    PATH = require('path'),
    EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits;

function LogStream(path) {
    EventEmitter.call(this);

    // create a readable stream for the source file, by line
    this.stream = fs.createReadStream(path).pipe(split('\n'));
    this.str = null;
    this.seq = null;

    // set to true when stream ends
    this.ended = false;

    // annoying hack to deal with end of stream
    this.stream.on('readable', () => { this.emit('ready'); });
    this.stream.on('end', () => { this.ended = true; this.emit('ready') });
}
inherits(LogStream, EventEmitter);

// returns a promise for when the next line has been read, or the stream has ended
LogStream.prototype.next = Promise.method(function () {
    // read data if any
    let data = this.stream.read();

    // if none, wait until ready and try again
    if (data === null) {
        // could just be done, abort loop if so
        if (this.ended) { return; }

        return new Promise(resolve =>
            this.once('ready', resolve)
        ).then(_ => this.next());
    }

    // if empty line, try again
    let str = data.toString();
    if (str.trim() === '') {
        return this.next();
    }

    // assign new message and sequence number to the log stream
    this.str = data.toString();
    this.seq = parseInt(this.str.split('\t')[0], 10);
});

fs.readdir$('./logs')
.map(filename => PATH.resolve(__dirname, 'logs', filename))
.map(path => new LogStream(path))
.each(logStream => logStream.next())
.then(sources => {
    // create the output stream
    let outStream = fs.createWriteStream('./merged.log');

    // bluebird's .map has ensured we've got either the first log
    // line or an empty/ended stream by the time we get here

    // filter any empty streams
    sources = sources.filter(source => !source.ended);

    // initial ordering of the streams
    sources.sort((a, b) => a.seq - b.seq);

    function bubble() {
        let activeSource = sources[0];

        // remove from queue if ended
        if (activeSource.ended) {
            sources.splice(0, 1);
            return;
        }

        // first source is no longer oldest, bubble it up the array
        let i = 0;
        while (i < sources.length - 1 && sources[i+1].seq < activeSource.seq) {
            sources[i] = sources[++i];
            sources[i] = activeSource;
        }
    }

    // while there's more than one source, read from the oldest
    // until it's no longer the oldest; then, adjust the sources
    // and continue until only one stream is left
    function merge() {
        // ensure the source with the oldest line comes first
        bubble();

        // get the next line, if there's anything to pull from
        if (sources.length) {
            outStream.write(sources[0].str+'\n');
            return sources[0].next()
                .then(merge); // recurse
        }
    }

    return merge();
});

