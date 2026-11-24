// Local flat-grey background keyer (free alternative to remove_background).
// usage: node docs/art/tools/key.cjs <in.png> <out.png> [tol=18] [seedX,seedY ...] [--global]
// Flood-fills from the image border (plus optional extra seed points) across pixels
// whose colour is within `tol` of the sampled corner background; those become transparent.
// A 1-px soft edge: neighbours within 2*tol get partial alpha.
const sharp = require('sharp');
const [,, inp, out, tolArg, ...seeds0] = process.argv;
const GLOBAL = seeds0.includes('--global'); // also key enclosed bg-coloured holes anywhere
const seeds = seeds0.filter(s => s !== '--global');
const tol = +(tolArg || 18);
(async () => {
  const { data, info } = await sharp(inp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const px = (x, y) => (y * W + x) * 4;
  // background = median of corner samples
  const cs = [[2,2],[W-3,2],[2,H-3],[W-3,H-3]].map(([x,y])=>{const i=px(x,y);return [data[i],data[i+1],data[i+2]]});
  const bg = [0,1,2].map(c => cs.map(v=>v[c]).sort((a,b)=>a-b)[1]);
  const dist = i => Math.max(Math.abs(data[i]-bg[0]),Math.abs(data[i+1]-bg[1]),Math.abs(data[i+2]-bg[2]));
  const mask = new Uint8Array(W*H); // 1 = background
  const stack = [];
  const push = (x,y) => { if (x<0||y<0||x>=W||y>=H) return; const k=y*W+x; if (mask[k]) return; if (dist(k*4) > tol) return; mask[k]=1; stack.push(k); };
  for (let x=0;x<W;x++){push(x,0);push(x,H-1);} for (let y=0;y<H;y++){push(0,y);push(W-1,y);}
  for (const s of seeds) { const [x,y]=s.split(',').map(Number); push(x,y); }
  if (GLOBAL) for (let k=0;k<W*H;k++) if (!mask[k] && dist(k*4) <= tol) { mask[k]=1; stack.push(k); }
  while (stack.length) { const k=stack.pop(); const x=k%W, y=(k/W)|0; push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1); }
  for (let k=0;k<W*H;k++){
    if (mask[k]) { data[k*4+3]=0; continue; }
    const x=k%W,y=(k/W)|0;
    const nb = (x>0&&mask[k-1])||(x<W-1&&mask[k+1])||(y>0&&mask[k-W])||(y<H-1&&mask[k+W]);
    if (nb) { const d=dist(k*4); if (d < 2*tol) data[k*4+3]=Math.round(255*(d-tol)/tol); }
  }
  await sharp(data,{raw:{width:W,height:H,channels:4}}).png().toFile(out);
  console.log(out, 'bg', bg.join(','), 'keyed', mask.reduce((a,b)=>a+b,0), 'of', W*H);
})();
