// Build Higgsfield batch requests for T-12. usage: node docs/art/tools/t12_build.cjs key1,key2,...
const P = require('./t12_prompts.json');
const REF = [{ value: '174186f2-e469-421b-a531-b0da32893b7b', role: 'image_references' }];
const nano = { plants_: '16:9', decor_: '16:9', foliage_: '16:9', props_: '4:3', wildlife_: '16:9' };
const gpt = { passengers_: '3:2', sights: '16:9', icons_: '1:1', wheel_rod: '16:9', frame_: '16:9' };
const keys = process.argv[2].split(',');
const out = keys.map((k, i) => {
  const isFrame = k.startsWith('frame_');
  const prompt = P.STYLE + '. ' + P.REFNOTE + ' ' + (isFrame ? '' : P.SHEET + ' ') + P[k];
  const n = Object.keys(nano).find(p => k.startsWith(p));
  const params = n
    ? { model: 'nano_banana_pro', aspect_ratio: nano[n], resolution: '2k', prompt, medias: REF }
    : { model: 'gpt_image_2_6', aspect_ratio: gpt[Object.keys(gpt).find(p => k.startsWith(p))], quality: 'medium', prompt, medias: REF };
  return { index: i, params };
});
console.log(JSON.stringify(out));
