import * as THREE from 'three';
import { makeCanvas, toTexture } from '../paint/canvas';

/** Procedural pixel sprites for VFX (used when no art exists). */
type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const cache = new Map<string, THREE.Texture>();
function tex(key: string, w: number, h: number, paint: Painter, pixel = true): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    const p = makeCanvas(w, h);
    paint(p.ctx, w, h);
    t = toTexture(p, pixel);
    cache.set(key, t);
  }
  return t;
}

const px = (ctx: CanvasRenderingContext2D, rows: string[], pal: Record<string, string>) => {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x] ?? '.'];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  });
};

export const heartBubbleTex = () =>
  tex('heart', 13, 13, (ctx) =>
    px(
      ctx,
      [
        '....ooooo....',
        '..oowwwwwoo..',
        '.owwwwwwwwwo.',
        '.ow.rr.rr.wo.',
        'owwrrrrrrrwwo',
        'owwrrrrrprwwo',
        'owwrrrrrrrwwo',
        'owwwrrrrrwwwo',
        '.owwwrrrwwwo.',
        '.owwwwrwwwwo.',
        '..oowwwwwoo..',
        '....ooooo....',
        '.............',
      ],
      { o: '#5aa9c4', w: '#e9fbff', r: '#ff5c7a', p: '#ffc2cf' },
    ),
  );

/**
 * T-27: "possible bond" hint — gold-rimmed cream bubble with a hollow heart and a teal "+" badge,
 * so it never reads like the solid red heart of a formed bond.
 */
export const ghostHintTex = () =>
  tex('ghostHint', 15, 15, (ctx) =>
    px(
      ctx,
      [
        '..........ggg..',
        '.....ooooggwgg.',
        '...oowwwwgwwwg.',
        '..owwwwwwggwgg.',
        '.owwhhwwwhgggo.',
        '.owhwwhwhwwhwo.',
        'owwhwwwhwwwhwwo',
        'owwhwwwwwwwhwwo',
        'owwwhwwwwwhwwwo',
        '.owwwhwwwhwwwo.',
        '.owwwwhwhwwwwo.',
        '..owwwwhwwwwo..',
        '...oowwwwwoo...',
        '.....ooooo.....',
        '...............',
      ],
      { o: '#b8792a', w: '#fff4d6', h: '#c9852b', g: '#1f8f8a' },
    ),
  );

export const coinTex = () =>
  tex('coin', 9, 9, (ctx) =>
    px(
      ctx,
      ['..ooooo..', '.oyyyyyo.', 'oyywwyyyo', 'oywyyyyyo', 'oyyyyyyyo', 'oyyyyyyyo', 'oyyyyydyo', '.oyyyddo.', '..ooooo..'],
      { o: '#9c7430', y: '#f4cf5a', w: '#fff6c8', d: '#d9ac4c' },
    ),
  );

export const sparkleTex = () =>
  tex('sparkle', 7, 7, (ctx) =>
    px(ctx, ['...w...', '...w...', '..wyw..', 'wwyyyww', '..wyw..', '...w...', '...w...'], { w: '#ffffff', y: '#fff3a8' }),
  );

export const bubbleTex = () =>
  tex('bubble', 8, 8, (ctx) =>
    px(ctx, ['..oooo..', '.o.w..o.', 'o.w....o', 'o......o', 'o......o', 'o......o', '.o....o.', '..oooo..'], { o: '#e8fbff', w: '#ffffff' }),
  );

export const flakeTex = () => tex('flake', 3, 2, (ctx) => px(ctx, ['oyo', '.o.'], { o: '#c98d4a', y: '#f1c27a' }));

export const confettiTex = (i: number) => {
  const cols = ['#ff7aa2', '#ffd447', '#6fd3c4', '#b98cf0', '#ff9a52', '#7cc6ec'];
  const c = cols[i % cols.length] ?? '#ffd447';
  return tex(`confetti${i % cols.length}`, 3, 2, (ctx) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 3, 2);
  });
};

export const splashTex = () =>
  tex('splash', 16, 10, (ctx) =>
    px(
      ctx,
      ['.......w........', '...w...w...w....', '....w.www.w.....', '.w..wwwwwww..w..', '..wwwwbwbwwww...', '.wwbbbbbbbbbww..', 'wwbbbbbbbbbbbbww', '.bbbbbbbbbbbbbb.', '................', '................'],
      { w: '#f4fffb', b: '#7fd3e6' },
    ),
  );

/** Soft round puff (for flashes / glows). */
export const softTex = () =>
  tex(
    'soft',
    32,
    32,
    (ctx) => {
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 32);
    },
    false,
  );
