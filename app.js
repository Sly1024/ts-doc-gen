"use strict";

let fs = require('fs');
let gtd = require('./ts-doc-gen');

let startTime = process.hrtime();

let fileNames = ['test1.ts'];
let files = fileNames.map( fileName => ({
    name: fileName, 
    contents: fs.readFileSync(fileName, 'utf8')
}));
 
gtd(files);

files.forEach((file) => {
    fs.writeFileSync('_'+file.name, file.augmented);
});

let timeSpan = process.hrtime(startTime);
console.log('time:', (timeSpan[0] * 1e9 + timeSpan[1])/1000000, ' ms');
