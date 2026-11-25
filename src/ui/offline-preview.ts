// Dev page for the offline postcard (served at /src/ui/offline-preview.html?line=3&station=4).
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/400.css';
import './hud.css';
import './panels.css';
import './screens.css';
import { formatNumber } from '../util/format';
import { initModals } from './modal';
import { showOffline } from './offline';
import type { UiCtx } from './panel';

const q = new URLSearchParams(location.search);
const line = Number(q.get('line') ?? 1);
const station = Number(q.get('station') ?? 3);
const state = { currentLine: line, marketStation: station, train: { fromStation: station } };
const app = document.getElementById('app') as HTMLElement;
initModals(app);
// Minimal ctx: the popup only reads sim state, fmt and sound. Cast: a preview stub, not a full UiCtx.
const ctx = { api: { sim: { state } }, fmt: (n: number) => formatNumber(n), sound: () => undefined } as unknown as UiCtx;
showOffline(ctx, { seconds: 2 * 3600 + 14 * 60, shells: 48210, stationsVisited: 37 });
