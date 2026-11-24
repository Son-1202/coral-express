import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classify } from '../../scripts/lib/groups';
import { OUTLINE_BASE, pixelizeImage, type Rgba } from '../../scripts/lib/pixel';
import { pixelizeFile, readRgba } from '../../scripts/pixelize';

/** 400×200 canvas, transparent margin, an orange ellipse with a soft semi-transparent halo. */
async function syntheticCutout(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
    <defs><filter id="b"><feGaussianBlur stdDeviation="6"/></filter></defs>
    <ellipse cx="200" cy="100" rx="150" ry="60" fill="#40e0d0" opacity="0.35" filter="url(#b)"/>
    <ellipse cx="200" cy="100" rx="130" ry="50" fill="#f08030"/>
    <rect x="180" y="80" width="40" height="40" fill="#fff8e0"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function toRgba(buf: Buffer): Promise<Rgba> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

const px = (img: Rgba, x: number, y: number) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

describe('pixelize pipeline', () => {
  it('respects target size, removes halo, adds a dark 1px outline', async () => {
    const src = await toRgba(await syntheticCutout());
    const { image, colors } = pixelizeImage(src, { size: 64, mode: 'long' });

    // Size: long side exactly 64 (aspect ~ 2.4:1 after trim keeps height smaller).
    expect(image.width).toBe(64);
    expect(image.height).toBeLessThan(40);

    // Halo removed: alpha is strictly binary.
    const alphas = new Set<number>();
    for (let i = 3; i < image.data.length; i += 4) alphas.add(image.data[i]);
    expect([...alphas].sort()).toEqual([0, 255]);

    // Outline: the outermost opaque pixel on the middle row is dark, the next one inward is the fill.
    const midY = Math.floor(image.height / 2);
    let x = 0;
    while (image.data[(midY * image.width + x) * 4 + 3] === 0) x++;
    const edge = px(image, x, midY), inner = px(image, x + 1, midY);
    const lum = (p: number[]) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
    expect(lum(edge)).toBeLessThan(80);
    expect(lum(inner)).toBeGreaterThan(110);
    expect(edge[2]).toBeGreaterThanOrEqual(Math.round(OUTLINE_BASE[2] * 0.5) - 1);
    // No teal halo colour survives on the fill boundary.
    expect(inner[0]).toBeGreaterThan(inner[2]);

    // 1 px transparent-free border = outline fits; corners stay transparent.
    expect(px(image, 0, 0)[3]).toBe(0);
    expect(colors).toBeGreaterThan(1);
    expect(colors).toBeLessThanOrEqual(32);
  });

  it('honours height / width size modes', async () => {
    const src = await toRgba(await syntheticCutout());
    expect(pixelizeImage(src, { size: 30, mode: 'height' }).image.height).toBe(30);
    expect(pixelizeImage(src, { size: 50, mode: 'width' }).image.width).toBe(50);
  });

  it('is deterministic and idempotent on disk', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pixelize-'));
    try {
      const inPath = join(dir, 'in.png');
      await sharp(await syntheticCutout()).toFile(inPath);
      const rule = classify('fish/krill.png');
      expect(rule).toMatchObject({ kind: 'sprite', size: 56 });
      if (rule.kind !== 'sprite') throw new Error('expected sprite');
      const a = await pixelizeFile(inPath, join(dir, 'out.png'), rule);
      const b = await pixelizeFile(inPath, join(dir, 'out.png'), rule);
      expect(a.status).toBe('new');
      expect(b.status).toBe('unchanged');
      const out = await readRgba(join(dir, 'out.png'));
      expect(Math.max(out.width, out.height)).toBe(56);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('classifies groups per the ticket table', () => {
    expect(classify('fish/pocket_whale_shiny.png')).toMatchObject({ size: 96 });
    expect(classify('plants/reef_1.png')).toMatchObject({ size: 72, mode: 'height' });
    expect(classify('train/locomotive.png')).toMatchObject({ size: 320, mode: 'width' });
    expect(classify('sights/whale.png')).toMatchObject({ size: 160 });
    expect(classify('scenery/l1_props_2.png')).toMatchObject({ kind: 'sprite', size: 96 });
    expect(classify('scenery/l1_far.png')).toMatchObject({ kind: 'painterly', maxWidth: 2560 });
    expect(classify('ui/postcard_l1s1.png')).toMatchObject({ kind: 'painterly', maxWidth: 960 });
    expect(classify('train/interior_reef.png')).toMatchObject({ kind: 'painterly', maxWidth: 1280 });
    expect(classify('mystery/thing.png')).toMatchObject({ kind: 'sprite', size: 64 });
  });
});
