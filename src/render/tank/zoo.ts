/**
 * `/?debug=zoo` — QA motion review: every species (all motion profiles incl. a `sinuous` demo),
 * every habitat's plants swaying, and every Sight animating. Standalone: owns its own renderer.
 * World: 80×64 units, y up; DOM labels are positioned in % of the 5:4 stage.
 * T-40: bigger species cells (5 columns, 10 units tall) and labels that scale with the stage.
 */
import * as THREE from 'three';
import { loadGameData, HABITATS, type Habitat, type SpeciesDef } from '../../data/schema';
import { FishActor, DecorActor, plantTexture, type Area } from './actors';
import { backdropUrls, sightUrls, tankTexture } from './assets';
import { HABITAT_COLORS, paintBackdrop, paintSight } from './paint';
import { makeRng } from './motion';

const W = 80;
const H = 64;
/** Fish drawn this much bigger than in Tank View so they read in the zoo cells (T-40). */
const ZOO_FISH_SIZE = 2.2;

export interface ZooHandle {
  /** Advance by dt seconds (works while paused — for deterministic screenshots). */
  step(dt: number): void;
  setPaused(p: boolean): void;
  dispose(): void;
}

interface Sight {
  id: string;
  mesh: THREE.Mesh;
  extra: THREE.Mesh[];
  cx: number;
  cy: number;
  w: number;
}

export function mountZoo(container: HTMLElement): ZooHandle {
  const data = loadGameData();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;margin:0 auto;width:min(100vw,125vh);aspect-ratio:80/64;container-type:inline-size;background:#17303a;font-family:"Pixelify Sans",system-ui,sans-serif;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  wrap.appendChild(canvas);
  container.appendChild(wrap);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#17303a');
  const camera = new THREE.OrthographicCamera(0, W, H, 0, -50, 50);
  camera.position.z = 20;

  const label = (text: string, x: number, y: number, size = 11, maxW = W) => {
    const d = document.createElement('div');
    d.textContent = text;
    // size ≈ px at a 1000 px wide stage, never below 12 px; on a dark plate so it reads on any backdrop
    d.style.cssText = `position:absolute;left:${(x / W) * 100}%;top:${((H - y) / H) * 100}%;font-size:max(12px,${(size * 0.13).toFixed(2)}cqw);color:#fbf3df;text-shadow:0 1px 0 #000;pointer-events:none;white-space:nowrap;background:rgba(10,28,34,.62);padding:1px 6px;border-radius:4px;max-width:calc(${(maxW / W) * 100}% - 12px);overflow:hidden;text-overflow:ellipsis;`;
    wrap.appendChild(d);
  };
  const quad = (x: number, y: number, w: number, h: number, mat: THREE.Material, z = -10) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x + w / 2, y + h / 2, z);
    scene.add(m);
    return m;
  };

  // ---- species grid: 5×4 cells (18 species + sinuous demo) ----
  const fish: FishActor[] = [];
  const cols = 5;
  const cw = W / cols;
  const ch = 10.6;
  const cells: { def: SpeciesDef; label: string }[] = data.species.map((d) => ({ def: d, label: `${d.name} · ${d.motion}${d.motionVariant ? '+tail' : ''}` }));
  const seadragon = data.species.find((s) => s.id === 'leafy_seadragon');
  if (seadragon) cells.push({ def: { ...seadragon, id: seadragon.id, motion: 'sinuous' }, label: 'sinuous profile demo' });
  cells.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x0 = col * cw + 0.15;
    const y0 = H - (row + 1) * ch - 0.6;
    const hab: Habitat = c.def.habitat === 'any' ? 'reef' : c.def.habitat;
    const back = tankTexture(backdropUrls(hab, `backdrop_${hab}_0`), () => paintBackdrop(hab));
    quad(x0, y0, cw - 0.3, ch - 0.3, new THREE.MeshBasicMaterial({ map: back }));
    quad(x0, y0, cw - 0.3, 0.9, new THREE.MeshBasicMaterial({ color: '#f2e2bd' }), -9);
    const area: Area = { x0, w: cw - 0.3, floor: y0 + 0.9, surface: y0 + ch - 0.4, margin: 0.2 };
    const seed = 1000 + i * 17;
    const a = new FishActor({ fishId: `zoo${i}`, def: c.def, level: 1, shiny: false, mascot: c.def.id === 'pebble_damsel', seed }, makeRng(seed), area, ZOO_FISH_SIZE);
    a.uniforms.uTint.value.set(HABITAT_COLORS[hab].deep);
    fish.push(a);
    scene.add(a.object);
    label(c.label, x0 + 0.3, y0 + ch - 0.5, 12, cw - 0.6);
  });

  // ---- plants: 5 habitats × 4, swaying ----
  const plants: DecorActor[] = [];
  const py = 9.5;
  quad(0, py - 0.4, W, 8.6, new THREE.MeshBasicMaterial({ color: '#21414c' }), -11);
  HABITATS.forEach((h, hi) => {
    label(`${h} plants`, hi * 16 + 0.5, py + 8, 14);
    for (let n = 1; n <= 4; n++) {
      const id = `${h}_${n}`;
      const def = data.plants.find((p) => p.id === id);
      const sway = def?.sway ?? { freq: 1, amp: 0.02 };
      const look = { tex: plantTexture(id, h, n), freq: sway.freq * 2.2, amp: sway.amp * 8, size: 5, isPlant: true };
      const a = new DecorActor(look, { id, x: 0, y: 0, layer: 'back', scale: 1, flip: false }, -1);
      const s = a.size();
      const k = Math.min(1, 6.5 / s.h, 3.6 / Math.abs(s.w));
      a.mesh.scale.multiplyScalar(k);
      a.mesh.position.set(hi * 16 + (n - 0.5) * 4, py, 0);
      plants.push(a);
      scene.add(a.mesh);
    }
  });

  // ---- sights ----
  const sights: Sight[] = [];
  quad(0, 0, W, 8.4, new THREE.MeshBasicMaterial({ color: '#7fc8d8' }), -11);
  quad(0, 0, W, 3, new THREE.MeshBasicMaterial({ color: '#3fa6b4' }), -10.5);
  data.sights.forEach((s, i) => {
    const cx = i * (W / 6) + W / 12;
    const tex = tankTexture(sightUrls(s.id), () => paintSight(s.id));
    const mk = () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, depthTest: false }));
      scene.add(m);
      return m;
    };
    const extra = s.id === 'dolphin_race' ? [mk(), mk()] : s.id === 'sea_fog' ? [mk()] : [];
    sights.push({ id: s.id, mesh: mk(), extra, cx, cy: 3, w: 3.4 });
    label(s.name, cx - 2.5, 8, 14);
  });

  const aspectOf = (m: THREE.Mesh) => ((m.material as THREE.MeshBasicMaterial).map?.userData.aspect as number | undefined) ?? 1.6;
  function animateSights(t: number): void {
    for (const s of sights) {
      const m = s.mesh;
      const a = aspectOf(m);
      const set = (mesh: THREE.Mesh, x: number, y: number, w: number, rot = 0, sy = 1, alpha = 1) => {
        mesh.position.set(x, y, 1);
        mesh.scale.set(w, (w / a) * sy, 1);
        mesh.rotation.z = rot;
        (mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
      };
      const u = (t % 4) / 4;
      switch (s.id) {
        case 'dolphin_race':
          [m, ...s.extra].forEach((d, k) => {
            const ph = (u + k * 0.33) % 1;
            const x = s.cx - 5 + ph * 10;
            const j = Math.max(0, Math.sin(ph * Math.PI * 4));
            set(d, x, 2.6 + j * 2.2, 2.2, Math.cos(ph * Math.PI * 4) * 0.5);
          });
          break;
        case 'seagull_thief':
          set(m, s.cx - 5 + ((t * 2.5) % 10), 5 + Math.sin(t * 3) * 0.8, s.w, Math.sin(t * 3) * 0.15, 0.75 + 0.25 * Math.abs(Math.sin(t * 9)));
          break;
        case 'whale_breach': {
          const v = (t % 3) / 3;
          const y = 1 + Math.sin(v * Math.PI) * 4.5;
          set(m, s.cx - 1 + v * 2, y, 4.2, (0.5 - v) * 1.2);
          break;
        }
        case 'festival_station':
          set(m, s.cx, 5 + Math.sin(t * 2) * 0.3, 4.5, Math.sin(t * 2.4) * 0.12, 1 + Math.sin(t * 6) * 0.08);
          break;
        case 'stowaway': {
          const peek = Math.max(0, Math.sin(t * 2.2));
          set(m, s.cx, 2.4 + Math.abs(Math.sin(t * 4)) * 0.35, s.w, Math.sin(t * 4) * 0.06, 0.85 + 0.25 * peek);
          break;
        }
        default:
          set(m, s.cx - 2 + ((t * 0.8) % 4), 4, 6, 0, 1, 0.5 + 0.3 * Math.sin(t));
          for (const e of s.extra) set(e, s.cx + 2 - ((t * 0.6) % 4), 5.2, 5, 0, 1, 0.5 + 0.3 * Math.cos(t));
      }
    }
  }

  let time = 0;
  let paused = false;
  let raf = 0;
  let last = performance.now();
  const resize = () => {
    const r = wrap.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(wrap);
  resize();

  function step(dt: number): void {
    time += dt;
    for (const f of fish) f.update(dt, { time, tilt: 0, food: null }, time);
    for (const p of plants) p.update(dt, time, 0);
    animateSights(time);
  }
  function draw(): void {
    renderer.render(scene, camera);
  }
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) step(dt);
    draw();
    raf = requestAnimationFrame(loop);
  };
  step(0);
  raf = requestAnimationFrame(loop);

  return {
    step(dt) {
      // fine sub-steps keep motion identical to real-time playback
      for (let t = 0; t < dt - 1e-9; t += 1 / 60) step(Math.min(1 / 60, dt - t));
      draw();
    },
    setPaused: (p) => void (paused = p),
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      for (const f of fish) f.dispose();
      for (const p of plants) p.dispose();
      renderer.dispose();
      wrap.remove();
    },
  };
}
