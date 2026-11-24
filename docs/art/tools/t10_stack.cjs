// usage: node docs/art/tools/t10_stack.cjs <out.jpg> <in1.jpg> <in2.jpg> ...  (stacks previews vertically at 900px wide)
const s=require('sharp');const [,,out,...ins]=process.argv;
(async()=>{const bufs=[];let y=0;const comps=[];
for(const f of ins){const b=await s(f).resize({width:900}).toBuffer({resolveWithObject:true});comps.push({input:b.data,top:y,left:0});y+=b.info.height+6;}
await s({create:{width:900,height:y,channels:3,background:'#000'}}).composite(comps).jpeg({quality:75}).toFile(out);console.log(out,y);})();
