/** T-27: twinkling 4-point sparkles around shiny fish in Tank View (written into a star PointCloud). */
import type { FishActor } from './actors';
import type { PointCloud } from './shaders';

const SPARKLES_PER_FISH = 4;

/** Deterministic 0..1 hash of an integer (sparkle placement). */
function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Each shiny fish twinkles: a few short-lived stars at seeded spots around its sprite. */
export function updateSparkles(sp: PointCloud, fish: Iterable<FishActor>, t: number): void {
  let i = 0;
  for (const f of fish) {
    if (!f.spec.shiny) continue;
    const p = f.pos;
    const hh = f.halfH;
    const sc = f.object.scale;
    const hw = hh * Math.min(2.2, Math.max(0.6, sc.y ? Math.abs(sc.x / sc.y) : 1));
    for (let k = 0; k < SPARKLES_PER_FISH && i < sp.capacity; k++, i++) {
      const cyc = t * 0.7 + k / SPARKLES_PER_FISH + (f.spec.seed % 97) / 97;
      const n = Math.floor(cyc);
      const life = cyc - n;
      const h1 = hash01(f.spec.seed + n * 131 + k * 17);
      const h2 = hash01(f.spec.seed * 3 + n * 71 + k * 29);
      sp.pos[i * 3] = p.x + (h1 * 2 - 1) * hw;
      sp.pos[i * 3 + 1] = p.y + (h2 * 2 - 1) * hh;
      sp.pos[i * 3 + 2] = 4;
      const a = Math.sin(life * Math.PI);
      sp.size[i] = 0.16 + 0.14 * a;
      sp.alpha[i] = a * 0.85;
    }
  }
  for (; i < sp.capacity; i++) sp.alpha[i] = 0;
}
