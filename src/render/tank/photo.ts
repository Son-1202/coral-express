/** Photo mode: frames (art file or procedural ticket / postcard / polaroid), PNG download, pinned postcards. */
import { firstExisting, frameUrls } from './assets';

export type FrameId = 1 | 2 | 3;
export const FRAME_NAMES: Record<FrameId, string> = { 1: 'Railway ticket', 2: 'Postcard', 3: 'Polaroid' };
export const PINNED_KEY = 'coral.stampbook.photos';
const MAX_PINNED = 12;

const frameImages = new Map<FrameId, HTMLImageElement>();
/** Preload any frame art that exists (else procedural is used). */
export function preloadFrames(): void {
  for (const n of [1, 2, 3] as FrameId[]) {
    const url = firstExisting(frameUrls(n));
    if (!url || frameImages.has(n)) continue;
    const img = new Image();
    img.src = url;
    frameImages.set(n, img);
  }
}

/** Draws the frame over a w×h canvas that already holds the photo. */
export function drawFrame(ctx: CanvasRenderingContext2D, n: FrameId, w: number, h: number, caption = 'Coral Express'): void {
  const img = frameImages.get(n);
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, 0, 0, w, h);
    return;
  }
  const u = Math.max(4, Math.round(Math.min(w, h) * 0.035));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (n === 1) {
    // railway ticket: cream border, punched holes, brass rule, stub text
    ctx.fillStyle = '#f4e6c4';
    ctx.fillRect(0, 0, w, u * 2);
    ctx.fillRect(0, h - u * 3, w, u * 3);
    ctx.fillRect(0, 0, u * 2, h);
    ctx.fillRect(w - u * 5, 0, u * 5, h);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(u * 2, u * 2 - 2, w - u * 7, 2);
    ctx.fillRect(u * 2, h - u * 3, w - u * 7, 2);
    ctx.setLineDash([u * 0.6, u * 0.6]);
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - u * 5, 0);
    ctx.lineTo(w - u * 5, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#3a2c1e';
    ctx.font = `bold ${Math.round(u * 1.2)}px "Pixelify Sans", monospace`;
    ctx.fillText(`${caption.toUpperCase()} · ADMIT ONE`, u * 2, h - u * 1.1);
    ctx.save();
    ctx.translate(w - u * 2.2, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('No. 0001', 0, 0);
    ctx.restore();
  } else if (n === 2) {
    // postcard: white border, stamp + postmark in the corner
    ctx.fillStyle = '#fffdf6';
    ctx.fillRect(0, 0, w, u * 1.5);
    ctx.fillRect(0, h - u * 1.5, w, u * 1.5);
    ctx.fillRect(0, 0, u * 1.5, h);
    ctx.fillRect(w - u * 1.5, 0, u * 1.5, h);
    const sw = u * 3.2;
    const sx = w - u * 1.5 - sw - u;
    const sy = u * 2.5;
    ctx.fillStyle = '#fffdf6';
    ctx.fillRect(sx - 4, sy - 4, sw + 8, sw * 1.2 + 8);
    ctx.fillStyle = '#8fd1b8';
    ctx.fillRect(sx, sy, sw, sw * 1.2);
    ctx.fillStyle = '#ff8a2a';
    ctx.fillRect(sx + sw * 0.25, sy + sw * 0.45, sw * 0.5, sw * 0.3);
    ctx.strokeStyle = 'rgba(60,40,30,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx - u * 0.5, sy + sw * 0.9, u * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#3a2c1e';
    ctx.font = `${Math.round(u * 1.1)}px "Pixelify Sans", monospace`;
    ctx.fillText(`Greetings from the ${caption}!`, u * 2.5, h - u * 2.4);
  } else {
    // polaroid: thick white frame, deep bottom with a handwritten-ish caption
    ctx.fillStyle = '#fbfbf7';
    ctx.fillRect(0, 0, w, u * 2);
    ctx.fillRect(0, h - u * 6, w, u * 6);
    ctx.fillRect(0, 0, u * 2, h);
    ctx.fillRect(w - u * 2, 0, u * 2, h);
    ctx.fillStyle = '#4a4a5a';
    ctx.font = `italic ${Math.round(u * 1.6)}px "Pixelify Sans", cursive`;
    ctx.textAlign = 'center';
    ctx.fillText(caption, w / 2, h - u * 2.4);
  }
  ctx.restore();
}

export function composePhoto(photo: HTMLCanvasElement, n: FrameId, caption?: string): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = photo.width;
  out.height = photo.height;
  const ctx = out.getContext('2d');
  if (!ctx) return photo;
  ctx.drawImage(photo, 0, 0);
  drawFrame(ctx, n, out.width, out.height, caption);
  return out;
}

export function downloadPng(canvas: HTMLCanvasElement, name: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

export interface PinnedPhoto {
  at: number;
  carId: string;
  frame: FrameId;
  dataUrl: string;
}

export function readPinned(): PinnedPhoto[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? (JSON.parse(raw) as PinnedPhoto[]) : [];
  } catch {
    return [];
  }
}

/** Saves a small JPEG thumbnail to the Stamp book list (localStorage). Returns false if storage failed. */
export function pinPostcard(canvas: HTMLCanvasElement, carId: string, frame: FrameId): boolean {
  const thumb = document.createElement('canvas');
  thumb.width = 480;
  thumb.height = Math.round((480 * canvas.height) / canvas.width);
  thumb.getContext('2d')?.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  const list = readPinned();
  list.unshift({ at: Date.now(), carId, frame, dataUrl: thumb.toDataURL('image/jpeg', 0.8) });
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify(list.slice(0, MAX_PINNED)));
    return true;
  } catch {
    return false;
  }
}
