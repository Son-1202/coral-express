import * as THREE from 'three';
import { PATHS, sharedTexture } from '../../assets';
import { makeCanvas } from '../paint/canvas';

const PASSENGER_PX = 70;
const COUNT_SPRITES = 12;
/** Passengers stroll on the near edge of the platform, in front of the train. */
const WALK_Z = 1.0;
const GROUND_Y = 0.0;

function paintPerson(n: number): HTMLCanvasElement {
  const p = makeCanvas(14, 30);
  const { ctx } = p;
  const coats = ['#e45b4f', '#2aa5a0', '#f2a33c', '#4c84c4', '#b98cf0', '#6fae5a'];
  ctx.fillStyle = '#3c3a46';
  ctx.fillRect(4, 22, 2, 8);
  ctx.fillRect(8, 22, 2, 8);
  ctx.fillStyle = coats[n % coats.length] ?? '#e45b4f';
  ctx.fillRect(2, 10, 10, 13);
  ctx.fillStyle = '#f4c9a4';
  ctx.fillRect(4, 3, 6, 7);
  ctx.fillStyle = '#5a3a2a';
  ctx.fillRect(3, 1, 8, 3);
  return p.canvas;
}

type Mode = 'walk' | 'board' | 'leave' | 'idle';
interface Pax {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  x: number;
  tx: number;
  speed: number;
  mode: Mode;
  t: number;
  cheer: number;
  phase: number;
  h: number;
  w: number;
}

/** Procedural passengers: walk with bob/lean, board carriages, cheer (jump + squash). */
export class Passengers {
  readonly group = new THREE.Group();
  private readonly list: Pax[] = [];
  private readonly geo = new THREE.PlaneGeometry(1, 1);
  private seed = 1;

  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed % 10000) / 10000;
  }

  private make(sprite: number, x: number): Pax {
    const n = ((sprite - 1 + COUNT_SPRITES) % COUNT_SPRITES) + 1;
    const tex = sharedTexture(PATHS.passenger(n), () => paintPerson(n), { pixel: true });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.renderOrder = 3;
    this.group.add(mesh);
    const p: Pax = { mesh, mat, x, tx: x, speed: 1.1 + this.rnd() * 0.5, mode: 'idle', t: 0, cheer: 0, phase: this.rnd() * 6, h: 0.6, w: 0.3 };
    this.list.push(p);
    return p;
  }

  /** Arrival: a few people walk from the platform ends to the carriages and board. */
  arrive(stationX: number, doorXs: number[], count: number, seed: number): void {
    this.seed = (seed % 2147483646) + 1;
    for (let i = 0; i < count; i++) {
      const tx = doorXs[Math.floor(this.rnd() * doorXs.length)] ?? stationX;
      const fromLeft = this.rnd() < 0.5;
      const p = this.make(1 + Math.floor(this.rnd() * COUNT_SPRITES), tx + (fromLeft ? -1 : 1) * (2 + this.rnd() * 2.5));
      p.tx = tx;
      p.mode = 'walk';
      p.t = 0.6 - i * 0.3;
    }
    // someone gets off and wanders away
    if (doorXs.length) {
      const p = this.make(1 + Math.floor(this.rnd() * COUNT_SPRITES), doorXs[0] ?? stationX);
      p.mode = 'leave';
      p.tx = stationX + 8;
      p.t = -1.2;
    }
  }

  /** A named request passenger walks to their carriage and celebrates. */
  visitor(sprite: number, x: number, toX: number): void {
    const p = this.make(sprite, x);
    p.tx = toX;
    p.mode = 'walk';
    p.cheer = 0;
    p.t = 0;
    setTimeout(() => (p.cheer = 1.2), 1800);
  }

  cheer(): void {
    for (const p of this.list) if (p.mode !== 'board') p.cheer = 1 + this.rnd() * 0.3;
  }

  /** The train left: everyone still waiting boards instantly. */
  depart(): void {
    for (const p of this.list) if (p.mode === 'walk') p.mode = 'board';
  }

  get count(): number {
    return this.list.length;
  }

  update(dt: number, time: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p) continue;
      p.t += dt;
      const img = p.mat.map?.image as { width?: number; height?: number } | undefined;
      const iw = img?.width ?? 14;
      const ih = img?.height ?? 30;
      const k = ih < 40 ? 1 / 45 : 1 / PASSENGER_PX;
      p.w = iw * k;
      p.h = ih * k;
      let y = GROUND_Y;
      let rot = 0;
      let sx = 1;
      let sy = 1;
      let face = p.tx >= p.x ? 1 : -1;
      let alpha = 1;
      if (p.t < 0) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.visible = true;
      if (p.mode === 'walk' || p.mode === 'leave') {
        const d = p.tx - p.x;
        const step = Math.sign(d) * Math.min(Math.abs(d), p.speed * dt);
        p.x += step;
        const walking = Math.abs(d) > 0.02;
        if (walking) {
          y += Math.abs(Math.sin(time * 9 * p.speed + p.phase)) * 0.05;
          rot = -Math.sign(d) * 0.07;
        }
        if (!walking && p.mode === 'walk' && p.cheer <= 0) {
          p.mode = 'board';
          p.t = 0;
        }
        if (p.mode === 'leave') {
          alpha = Math.min(1, p.t * 2) * Math.min(1, Math.abs(d) / 1.5);
          if (!walking) alpha = 0;
        }
      }
      if (p.mode === 'board') {
        const u = Math.min(1, p.t / 0.6);
        y += u * 0.25;
        sx = sy = 1 - u * 0.5;
        alpha = 1 - u;
        face = 1;
      }
      if (p.cheer > 0) {
        p.cheer = Math.max(0, p.cheer - dt);
        const j = Math.abs(Math.sin(p.cheer * Math.PI * 3));
        y += j * 0.22;
        sy *= 1 + (j > 0.9 ? -0.15 : j * 0.1);
        sx *= 1 + (j > 0.9 ? 0.12 : 0);
      }
      p.mat.opacity = alpha;
      p.mat.transparent = true;
      p.mesh.position.set(p.x, y + (p.h * sy) / 2, WALK_Z);
      p.mesh.scale.set(p.w * sx * face, p.h * sy, 1);
      p.mesh.rotation.z = rot;
      if (alpha <= 0.01 && p.t > 0.2) {
        this.group.remove(p.mesh);
        p.mat.dispose();
        this.list.splice(i, 1);
      }
    }
  }
}
