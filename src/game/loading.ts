import { PATHS, fileUrl, hasFile } from '../assets';
import { interiorPath } from '../render/train/interior';

/**
 * Loading screen driver (T-19). The ticket card lives in index.html so it shows
 * before any JS; this preloads the current Line's textures (browser cache then
 * serves the real texture loads instantly) and fades the card out. Other Lines'
 * scenery is loaded lazily when they are first shown.
 */
export function bootUrls(line: number, habitats: string[]): string[] {
  const paths: { p: string; webp?: boolean }[] = [
    { p: PATHS.scenery(line, 'far'), webp: true },
    { p: PATHS.scenery(line, 'mid'), webp: true },
    { p: PATHS.scenery(line, 'near'), webp: true },
    { p: PATHS.station(line) },
    { p: '/train/locomotive.png' },
    { p: '/train/car_shell.png' },
    { p: '/ui/title_keyart.png', webp: true },
    ...habitats.map((h) => ({ p: interiorPath(h), webp: true })),
    ...[1, 2, 3, 4].map((k) => ({ p: `/scenery/l${line}_props_${k}.png` })),
    ...[1, 2, 3].map((k) => ({ p: `/scenery/l${line}_foliage_${k}.png` })),
  ];
  return [...new Set(paths.filter((x) => hasFile(x.p)).map((x) => fileUrl(x.p, !!x.webp)))];
}


/** Preload `urls`, driving the bar; resolves when done (or after `timeoutMs`), then fades the card. */
export function runLoading(urls: string[], o: { region?: string; timeoutMs?: number } = {}): Promise<void> {
  const root = document.getElementById('loading');
  const fill = document.getElementById('ld-fill');
  const text = document.getElementById('ld-text');
  const to = root?.querySelector('.ld-row span:last-child');
  if (to && o.region) to.textContent = `To: ${o.region}`;
  let done = 0;
  const total = Math.max(1, urls.length);
  const tick = () => {
    const pct = Math.round((done / total) * 100);
    if (fill) fill.style.width = `${pct}%`;
    root?.setAttribute('aria-valuenow', String(pct));
    if (text) text.textContent = pct < 100 ? `Loading scenery… ${pct}%` : 'All aboard!';
  };
  tick();
  const loads = urls.map(
    (u) =>
      new Promise<void>((res) => {
        const img = new Image();
        img.onload = img.onerror = () => {
          done++;
          tick();
          res();
        };
        img.src = u;
      }),
  );
  const timeout = new Promise<void>((res) => setTimeout(res, o.timeoutMs ?? 15000));
  return Promise.race([Promise.all(loads).then(() => undefined), timeout]).then(() => hideLoading());
}

export function hideLoading(): void {
  const root = document.getElementById('loading');
  if (!root || root.classList.contains('done')) return;
  root.classList.add('done');
  setTimeout(() => root.remove(), 600);
}
