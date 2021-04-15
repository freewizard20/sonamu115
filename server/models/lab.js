// const xss = require('xss');
// const path = require('path');
// const filename = 'old/123123123123';

// console.log(path.parse(filename).name);
// console.log(path.parse(filename).ext==='');
// console.log(path.parse(filename).dir);

// function test(){
//     let result = 0;
//     setTimeout(() => {
//         result = 3;
//         return result;
//     }, 3000);
// }

// console.log(test());

var Jimp = require('jimp');

let imgActive = 'tmp.jpg';

Jimp.read('test.jpg')
      .then((tpl) =>
          Jimp.read('../public/assets/watermark.png').then((logoTpl) => {
              logoTpl.opacity(0.4)
              return tpl.composite(logoTpl, 275, 175, [Jimp.BLEND_DESTINATION_OVER])
          }),
      )
      .then((tpl) => tpl.write('watermark.png'))
      .then(()=>{console.log('1')});