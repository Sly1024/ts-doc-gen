"use strict";

let fs = require('fs');
let gtd = require('./ts-doc-gen');

let fileNames = ['test1.ts'];
let files = fileNames.map( fileName => ({
    name: fileName, 
    contents: fs.readFileSync(fileName, 'utf8')
}));
 
let startTime = process.hrtime();

gtd(files);

let timeSpan = process.hrtime(startTime);
console.log('time:', (timeSpan[0] * 1e9 + timeSpan[1])/1000000, ' ms');

files.forEach((file) => {
    fs.writeFileSync('_'+file.name, file.augmented);
});
