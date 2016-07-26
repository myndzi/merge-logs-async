'use strict';

var fs = require('fs');

function rand(min, max) {
    return Math.floor(Math.random() * (max-min+1)) + min;
}

function randMsg() {
    let numWords = rand(3, 15);
    return new Array(numWords).fill(0).map(_ => 
        Math.random().toString(36).slice(2, rand(3, 15))
    ).join(' ');
}

function logSequence(stream) {
    let i, seq = 0, msg;
    for (i = 0; i < 250; i++) {
        seq += rand(1, 10);
        msg = randMsg();
        stream.write(`${seq}\t${msg}\n`);
    }
    stream.end();
}

// requires 'logs' dir to exist
function createFiles(numFiles) {
    let i;
    for (i = 0; i < numFiles; i++) {
        logSequence(fs.createWriteStream(`./logs/logfile${i}.log`));
    }
}

createFiles(4);