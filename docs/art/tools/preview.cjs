// usage: node docs/art/tools/preview.js <in.png> <out.jpg> [width]
const sharp = require('sharp');
const [,, inp, out, w] = process.argv;
sharp(inp).flatten({background:'#ff00ff'}).resize({width: +(w||1000)}).jpeg({quality:80}).toFile(out).then(i=>console.log(out, i.width+'x'+i.height));
