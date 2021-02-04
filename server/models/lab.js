// const xss = require('xss');
// const path = require('path');
// const filename = 'old/123123123123';

// console.log(path.parse(filename).name);
// console.log(path.parse(filename).ext==='');
// console.log(path.parse(filename).dir);

function test(){
    let result = 0;
    setTimeout(() => {
        result = 3;
        return result;
    }, 3000);
}

console.log(test());