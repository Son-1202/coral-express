import sharp from 'sharp';
const f=process.argv[2];
const {data,info}=await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height;const a=(x,y)=>data[(y*W+x)*4+3];
// flood from center to find window hole bbox
const cx=W>>1, cy=Math.floor(H*0.4);let x0=cx,x1=cx,y0=cy,y1=cy;
while(x0>0&&a(x0-1,cy)<128)x0--;while(x1<W-1&&a(x1+1,cy)<128)x1++;
while(y0>0&&a(cx,y0-1)<128)y0--;while(y1<H-1&&a(cx,y1+1)<128)y1++;
console.log(W,H,'hole',x0,x1,y0,y1);
// opaque bbox
let bx0=W,bx1=0,by0=H,by1=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(a(x,y)>128){bx0=Math.min(bx0,x);bx1=Math.max(bx1,x);by0=Math.min(by0,y);by1=Math.max(by1,y);}console.log('opaque',bx0,bx1,by0,by1);
