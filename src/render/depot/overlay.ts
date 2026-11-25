/** DOM layer for the depot scene: white fades, caption card and a Skip button. */
export class DepotOverlay {
  private readonly root = document.createElement('div');
  private readonly fade = document.createElement('div');
  private readonly card = document.createElement('div');
  private readonly onKey: (e: KeyboardEvent) => void;

  constructor(host: HTMLElement, skip: () => void, cars: number, fish: number) {
    const r = this.root;
    r.className = 'depot-scene';
    r.style.cssText = 'position:fixed;inset:0;z-index:55;pointer-events:auto;cursor:pointer;font-family:"Pixelify Sans",sans-serif;';
    this.fade.style.cssText = 'position:absolute;inset:0;background:#fffaf0;opacity:1;pointer-events:none;';
    const c = this.card;
    c.style.cssText =
      'position:absolute;left:50%;top:14%;transform:translateX(-50%);padding:10px 22px;background:#fbf1d6;color:#2f4a4a;border:3px solid #d9ac4c;border-radius:10px;box-shadow:0 5px 0 rgba(0,0,0,.25);text-align:center;opacity:0;transition:opacity .5s;max-width:80vw;';
    const rest = cars > 0 ? `${cars} carriage${cars > 1 ? 's' : ''} rest${cars > 1 ? '' : 's'} on the siding` : 'The Heritage Carriage rolls on';
    // T-35: short (phone landscape) screens get a compact card at the very top so the shed's roof stays visible
    const short = window.innerHeight < 520;
    if (short) c.style.cssText += 'top:8px;padding:5px 14px;max-width:92vw;white-space:nowrap;border-width:2px;';
    c.innerHTML = `<b style="font-size:${short ? 15 : 20}px">The Depot</b><br><span style="font-size:${short ? 11 : 14}px">${rest}${fish > 0 ? ' · the fish doze in the depot pool' : ''}</span>`;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Skip ›';
    b.style.cssText = 'position:absolute;right:16px;bottom:16px;padding:8px 16px;font:600 15px "Pixelify Sans",sans-serif;background:#e8c56a;color:#3a2a1a;border:2px solid #a9822f;border-radius:8px;cursor:pointer;';
    const go = (e: Event) => {
      e.stopPropagation();
      skip();
    };
    b.addEventListener('click', go);
    r.addEventListener('click', go);
    this.onKey = (e) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.stopPropagation();
        skip();
      }
    };
    window.addEventListener('keydown', this.onKey, true);
    r.append(this.fade, c, b);
    host.append(r);
    // hide the HUD / toasts while the scene plays
    if (!document.getElementById('depot-scene-css')) {
      const st = document.createElement('style');
      st.id = 'depot-scene-css';
      st.textContent = '.depot-scene-on .ui-root{visibility:hidden}';
      document.head.append(st);
    }
    document.body.classList.add('depot-scene-on');
  }

  update(t: number, T: { fadeOut: number; end: number }): void {
    const fadeIn = Math.max(0, 1 - t / 0.5);
    const fadeOut = Math.max(0, Math.min(1, (t - T.fadeOut) / (T.end - T.fadeOut - 0.1)));
    this.fade.style.opacity = String(Math.max(fadeIn, fadeOut));
    this.card.style.opacity = t > 0.8 && t < T.fadeOut ? '1' : '0';
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey, true);
    document.body.classList.remove('depot-scene-on');
    this.root.remove();
  }
}
