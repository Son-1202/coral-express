import * as THREE from 'three';
import { loadTexture } from '../../assets';
import { toTexture } from '../paint/canvas';
import { CAR, LOCO, TANK_WINDOW, paintCarriage, paintLocomotive, paintWheel } from './paintTrain';
import { createTank, paintFish, type Tank } from './tank';
import { Steam } from './steam';

const GAP = 0.14;
const BODY_LIFT = 0.05;

interface Wheel {
  mesh: THREE.Mesh;
  r: number;
}

interface FishSprite {
  mesh: THREE.Mesh;
  cx: number;
  cy: number;
  range: number;
  speed: number;
  phase: number;
  dir: number;
}

interface Part {
  group: THREE.Group;
  body: THREE.Group;
  wheels: Wheel[];
  tank?: Tank;
  fish: FishSprite[];
  phase: number;
}

function sprite(tex: THREE.Texture, w: number, h: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 }),
  );
  return m;
}

/** Placeholder train: locomotive + 3 glass aquarium carriages, side view facing +X. */
export class Train {
  readonly group = new THREE.Group();
  readonly steam = new Steam();
  readonly parts: Part[] = [];
  /** Local X of each carriage centre (index 0 = locomotive). */
  readonly centers: number[] = [];
  readonly length: number;
  private rods: THREE.Mesh[] = [];
  private slosh = 0;
  private sloshVel = 0;
  private chimney = new THREE.Vector3();

  constructor(carriages = 3) {
    const wheelBig = toTexture(paintWheel(10, true), true);
    const wheelSmall = toTexture(paintWheel(6, false), true);
    this.length = LOCO.w + carriages * (CAR.w + GAP);
    let front = this.length / 2;
    this.parts.push(this.makeLoco(wheelBig, front - LOCO.w / 2));
    front -= LOCO.w + GAP;
    for (let i = 0; i < carriages; i++) {
      this.parts.push(this.makeCar(wheelSmall, front - CAR.w / 2, i));
      front -= CAR.w + GAP;
    }
    for (const p of this.parts) this.centers.push(p.group.position.x);
  }

  private makeLoco(wheelTex: THREE.Texture, x: number): Part {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.position.x = x;
    group.add(body);
    const tex = loadTexture('train.locomotive', paintLocomotive, { pixel: true });
    const m = sprite(tex, LOCO.w, LOCO.h);
    m.position.set(0, BODY_LIFT + LOCO.h / 2, 0);
    body.add(m);
    const wheels: Wheel[] = [];
    const r = 0.27;
    for (const wx of [-0.15, 0.48, 1.11]) {
      const w = sprite(wheelTex, r * 2, r * 2);
      w.position.set(wx, r, 0.02);
      group.add(w);
      wheels.push({ mesh: w, r });
    }
    const rr = 0.18;
    const trailing = sprite(wheelTex, rr * 2, rr * 2);
    trailing.position.set(-1.05, rr, 0.02);
    group.add(trailing);
    wheels.push({ mesh: trailing, r: rr });
    // coupling rod linking the driving wheels
    const rod = new THREE.Mesh(
      new THREE.PlaneGeometry(1.36, 0.06),
      new THREE.MeshBasicMaterial({ color: '#c9d2d6' }),
    );
    rod.position.set(0.48, r, 0.03);
    group.add(rod);
    this.rods.push(rod);
    this.chimney.set(x + LOCO.w / 2 - 0.52, BODY_LIFT + LOCO.h - 0.3, 0);
    this.group.add(group);
    return { group, body, wheels, fish: [], phase: 0 };
  }

  private makeCar(wheelTex: THREE.Texture, x: number, i: number): Part {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.position.x = x;
    group.add(body);
    const tex = loadTexture('train.carriage', () => paintCarriage(11 + i), { pixel: true });
    const frame = sprite(tex, CAR.w, CAR.h);
    frame.position.set(0, BODY_LIFT + CAR.h / 2, 0.02);
    body.add(frame);
    // tank interior behind the window
    const tank = createTank(3 + i * 7, TANK_WINDOW.w + 0.04, TANK_WINDOW.h + 0.04);
    const wcx = -CAR.w / 2 + TANK_WINDOW.x + TANK_WINDOW.w / 2;
    const wcy = BODY_LIFT + TANK_WINDOW.y + TANK_WINDOW.h / 2;
    tank.mesh.position.set(wcx, wcy, -0.02);
    body.add(tank.mesh);
    const fish: FishSprite[] = [];
    const n = 3 + (i % 2);
    for (let f = 0; f < n; f++) {
      const ft = toTexture(paintFish(f + i), true);
      const s = 0.46 + (f % 2) * 0.08;
      const fm = sprite(ft, s, (s * 11) / 16);
      fm.position.z = 0.0 - f * 0.001;
      body.add(fm);
      fish.push({
        mesh: fm,
        cx: wcx + (f - n / 2) * 0.25,
        cy: wcy - 0.1 + ((f * 0.37) % 0.4) - 0.1,
        range: 0.35 + (f % 3) * 0.15,
        speed: 0.35 + f * 0.13,
        phase: f * 1.9 + i,
        dir: 1,
      });
    }
    const wheels: Wheel[] = [];
    const r = 0.17;
    for (const wx of [-0.95, -0.57, 0.57, 0.95]) {
      const w = sprite(wheelTex, r * 2, r * 2);
      w.position.set(wx, r, 0.03);
      group.add(w);
      wheels.push({ mesh: w, r });
    }
    // coupling link to the vehicle in front
    const link = new THREE.Mesh(new THREE.PlaneGeometry(GAP + 0.1, 0.06), new THREE.MeshBasicMaterial({ color: '#34474c' }));
    link.position.set(CAR.w / 2 + GAP / 2, 0.26, -0.01);
    group.add(link);
    this.group.add(group);
    return { group, body, wheels, tank, fish, phase: 0.7 + i * 0.55 };
  }

  /** speed in world units/s, accel in units/s². */
  update(dt: number, time: number, speed: number, accel: number): void {
    // signature slosh: damped spring driven by acceleration
    this.sloshVel += (-accel * 0.35 - this.slosh * 14) * dt;
    this.sloshVel *= Math.exp(-dt * 3.2);
    this.slosh += this.sloshVel * dt;
    const sp = Math.min(1, speed / 2.5);
    for (const p of this.parts) {
      for (const w of p.wheels) w.mesh.rotation.z -= (speed * dt) / w.r;
      // rocking on rail joints, front → back delay
      const joint = Math.pow(Math.max(0, Math.sin(time * speed * 1.7 - p.phase * 2)), 12);
      p.body.rotation.z = Math.sin(time * 2.1 + p.phase) * 0.006 * sp + joint * 0.006 * sp;
      p.body.position.y = joint * 0.025 * sp + Math.sin(time * 9 + p.phase) * 0.004 * sp;
      if (p.tank) {
        p.tank.setTilt(this.slosh * 1.6);
        p.tank.update(time);
      }
      for (const f of p.fish) {
        const t = time * f.speed + f.phase;
        const vx = Math.cos(t);
        const want = vx >= 0 ? 1 : -1;
        f.dir += (want - f.dir) * Math.min(1, dt * 6);
        const squash = 1 - (1 - Math.abs(f.dir)) * 0.3;
        f.mesh.scale.set(f.dir, squash + (1 - squash) * 0.5, 1);
        f.mesh.position.x = f.cx + Math.sin(t) * f.range - this.slosh * 0.5;
        f.mesh.position.y = f.cy + Math.sin(t * 1.7 + f.phase) * 0.06;
        f.mesh.rotation.z = Math.sin(time * 8 * (0.5 + speed * 0.1) + f.phase) * 0.06;
      }
    }
    const loco = this.parts[0];
    const a = loco?.wheels[0]?.mesh.rotation.z ?? 0;
    for (const rod of this.rods) {
      rod.position.x = 0.48 + Math.cos(a) * 0.11;
      rod.position.y = 0.27 + Math.sin(a) * 0.11;
    }
    const origin = this.chimney.clone().add(this.group.position);
    this.steam.update(dt, origin, speed);
  }
}
