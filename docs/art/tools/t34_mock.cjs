// T-34 mock composite of the depot scene (for the backdrop decision + contact sheet): node docs/art/tools/t34_mock.cjs <line 1|2|3> <out.png>
const sharp = require('sharp'); const path = require('path');
const A = p => path.resolve(__dirname, '../../../assets', p);
(async () => {
  const line = process.argv[2] || '1', out = process.argv[3];
  const W = 1600, H = 720, RAIL = 560;
  const far = await sharp(A(`scenery/l${line}_far.png`)).resize(W, H, { fit: 'cover', position: 'top' }).png().toBuffer();
  const ym = await sharp(A('depot/yard.png')).metadata(); const ys = 0.34, yw = Math.round(ym.width * ys), yh = Math.round(ym.height * ys);
  const yard = await sharp(A('depot/yard.png')).resize(yw, yh).png().toBuffer();
  const comp = [{ input: far, left: 0, top: 0 }];
  // gravel ground under everything below the crates
  comp.push({ input: { create: { width: W, height: H - 470, channels: 4, background: '#5d564d' } }, left: 0, top: 470 });
  for (let x = 0; x < W; x += yw) comp.push({ input: yard, left: x, top: RAIL - yh + 40 });
  const meta = async p => (await sharp(A(p)).metadata());
  const shed = await meta('depot/shed.png'); comp.push({ input: A('depot/shed.png'), left: 640, top: RAIL - shed.height + 6 });
  // rails (drawn in code in-game)
  comp.push({ input: { create: { width: W, height: 6, channels: 4, background: '#6b6f78' } }, left: 0, top: RAIL });
  comp.push({ input: { create: { width: W, height: 4, channels: 4, background: '#9aa0aa' } }, left: 0, top: RAIL - 2 });
  const loco = await meta('train/locomotive.png'), car = await meta('train/car_shell.png');
  comp.push({ input: A('train/car_shell.png'), left: 420, top: RAIL - car.height });
  comp.push({ input: A('train/car_shell.png'), left: 420 + car.width + 6, top: RAIL - car.height });
  comp.push({ input: A('train/locomotive.png'), left: 420 + 2 * (car.width + 6), top: RAIL - loco.height });
  const buf = await meta('depot/buffer.png'); comp.push({ input: A('depot/buffer.png'), left: 1460, top: RAIL - buf.height + 2 });
  const pool = await meta('depot/pool.png'); comp.push({ input: A('depot/pool.png'), left: 40, top: H - pool.height - 12 });
  // a few fish over the pool's water band to check it reads as "swimming in it"
  const fish = ['clownfish', 'blue_tang', 'goby'].map(f => `fish/${f}.png`);
  let fx = 170; for (const f of fish) { try { await meta(f); comp.push({ input: A(f), left: fx, top: H - pool.height + 70 }); fx += 120; } catch { } }
  await sharp({ create: { width: W, height: H, channels: 4, background: '#000' } }).composite(comp).png().toFile(out);
  console.log('mock', out);
})();
