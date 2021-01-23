const xss = require('xss');
const html = xss('<script>alert("xss");</script>');
console.log(html);