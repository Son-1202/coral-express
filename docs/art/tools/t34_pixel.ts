// T-34 depot sprites, step 2: npx tsx docs/art/tools/t34_pixel.ts
// assets/_cut/depot/*.png -> assets/depot/*.png with the project pixelizer (scripts/pixelize.ts) and explicit sizes,
// because scripts/lib/groups.ts has no 'depot' group yet (unknown paths would fall back to 64 px).
// Scale reference: locomotive 320 px wide x 151 tall; station 384 px wide.
import { pixelizeFile } from '../../../scripts/pixelize';
const RULES: [string, number, 'width' | 'height'][] = [
  ['shed', 640, 'width'],      // arched doorway ~188 x 196 px: the loco (151 px tall) fits under it
  ['shed_alt', 640, 'width'],  // candidate A (brick); not used unless DEV/PM prefer it
  ['pool', 640, 'width'],
  ['buffer', 80, 'height'],
];
for (const [name, size, mode] of RULES) {
  const r = await pixelizeFile(`assets/_cut/depot/${name}.png`, `assets/depot/${name}.png`, { kind: 'sprite', group: 'depot', size, mode }, 48);
  console.log(name, r.src, '->', r.out, r.colors, 'colours', r.status);
}
