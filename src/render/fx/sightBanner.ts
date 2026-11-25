/**
 * Small DOM banner under the HUD naming the active Sight (QA bug 3). The name
 * comes from `sights.json`; a "TAP" chip marks Sights that need a tap.
 */
export class SightBanner {
  private readonly el = document.createElement('div');
  private readonly name = document.createElement('span');
  private readonly chip = document.createElement('span');
  private shown: string | null = null;

  constructor(host: HTMLElement) {
    const e = this.el;
    e.className = 'sight-banner';
    e.setAttribute('role', 'status');
    e.style.cssText =
      'position:fixed;left:50%;top:calc(max(10px, env(safe-area-inset-top)) + 58px);transform:translate(-50%,-8px);z-index:2;pointer-events:none;' +
      'display:flex;align-items:center;gap:8px;padding:4px 14px;background:#fbf1d6;color:#2f4a52;border:2px solid #d9ac4c;border-radius:999px;' +
      'box-shadow:0 3px 0 rgba(80,60,30,.25);font:600 15px/20px "Pixelify Sans",sans-serif;font-variant-ligatures:none;white-space:nowrap;' +
      'opacity:0;transition:opacity .35s, transform .35s;';
    this.chip.textContent = 'TAP';
    this.chip.style.cssText = 'font-size:11px;line-height:16px;padding:0 6px;border-radius:6px;background:#2aa5a0;color:#fff;';
    const star = document.createElement('span');
    star.textContent = '✦';
    star.style.cssText = 'color:#d9ac4c;';
    e.append(star, this.name, this.chip);
    host.append(e);
  }

  /** `null` hides the banner. */
  set(id: string | null, name = '', needsTap = false): void {
    if (id === this.shown) return;
    this.shown = id;
    if (id) {
      this.name.textContent = name;
      this.chip.style.display = needsTap ? '' : 'none';
      this.el.style.opacity = '1';
      this.el.style.transform = 'translate(-50%,0)';
    } else {
      this.el.style.opacity = '0';
      this.el.style.transform = 'translate(-50%,-8px)';
    }
  }

  get current(): string | null {
    return this.shown;
  }
}
