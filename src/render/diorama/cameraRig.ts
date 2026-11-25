import * as THREE from 'three';
import { damp } from '../anim/ease';
import { WORLD } from './config';

/** Camera follow rate (1/s): lag behind a steadily moving target is speed / rate. */
export const FOLLOW_RATE = 2.2;

/**
 * One step of the exponential follow x' = k·(target − x), integrated exactly for a
 * target that moved linearly from `prevTarget` to `target` during `dt` (T-25).
 * Unlike `x += (target − x)·(1 − e^(−k·dt))`, the steady-state lag behind a moving
 * target does not depend on the frame time, so uneven frames (16/33 ms) cause no jitter.
 */
export function followStep(x: number, target: number, prevTarget: number, dt: number, k: number): number {
  if (dt <= 0) return x;
  const a = Math.exp(-k * dt);
  if (!Number.isFinite(prevTarget)) return target + (x - target) * a;
  const vk = (target - prevTarget) / dt / k;
  return target + (x - prevTarget + vk) * a - vk;
}

/** Narrow-FOV perspective camera with slight downward tilt that follows a target with easing + sway. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private x = 0;
  private pan = 0;
  private zoom = 1;
  private zoomTarget = 1;
  private shake = 0;
  /** Previous follow target (for the target-velocity term of the exact follow step). */
  private lastTarget = Number.NaN;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(WORLD.fov, aspect, 0.5, 900);
  }

  snap(x: number): void {
    this.x = x;
    this.lastTarget = Number.NaN;
  }

  /** >1 pulls the camera back (Whale Breach); eased. */
  setZoom(z: number): void {
    this.zoomTarget = z;
  }

  /** Small screen nudge (milestones). */
  nudge(amount = 1): void {
    this.shake = Math.max(this.shake, amount);
  }

  /** World X the camera currently looks at. */
  get focusX(): number {
    return this.x;
  }

  get panOffset(): number {
    return this.pan;
  }

  /** Extra manual pan offset (drag/scroll), eases back to 0 over time. */
  addPan(dx: number): void {
    this.pan = Math.max(-14, Math.min(14, this.pan + dx));
  }

  update(dt: number, time: number, targetX: number, speed: number): void {
    this.pan *= Math.exp(-dt * 0.35);
    this.zoom += (this.zoomTarget - this.zoom) * damp(0.9, dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake;
    const shX = Math.sin(time * 47) * 0.08 * sh;
    const shY = Math.cos(time * 53) * 0.06 * sh;
    const lead = speed * 0.45;
    this.x = followStep(this.x, targetX + lead + this.pan, this.lastTarget, dt, FOLLOW_RATE);
    this.lastTarget = targetX + lead + this.pan;
    const tilt = THREE.MathUtils.degToRad(WORLD.camTiltDeg);
    const sway = Math.sin(time * 0.6) * 0.04 + Math.sin(time * 1.37) * 0.015;
    const c = this.camera;
    // On narrow (portrait-ish) screens, pull back so the train still fits.
    const fit = Math.max(1, 1.5 / Math.max(0.6, c.aspect));
    const d = WORLD.camDist * fit * this.zoom;
    const lift = (this.zoom - 1) * 2.2;
    c.position.set(this.x + sway * 0.6 + shX, WORLD.focusY + lift + Math.sin(tilt) * d + sway * 0.3 + shY, Math.cos(tilt) * d);
    c.rotation.set(-tilt, 0, Math.sin(time * 0.45) * 0.0025);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
