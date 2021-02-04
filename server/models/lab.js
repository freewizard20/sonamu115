const xss = require('xss');
const path = require('path');
const filename = 'old/123123123123';

console.log(path.parse(filename).name);
console.log(path.parse(filename).ext==='');
console.log(path.parse(filename).dir);