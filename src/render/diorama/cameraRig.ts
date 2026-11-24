import * as THREE from 'three';
import { damp } from '../anim/ease';
import { WORLD } from './config';

/** Narrow-FOV perspective camera with slight downward tilt that follows a target with easing + sway. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private x = 0;
  private pan = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(WORLD.fov, aspect, 0.5, 900);
  }

  snap(x: number): void {
    this.x = x;
  }

  /** Extra manual pan offset (drag/scroll), eases back to 0 over time. */
  addPan(dx: number): void {
    this.pan = Math.max(-14, Math.min(14, this.pan + dx));
  }

  update(dt: number, time: number, targetX: number, speed: number): void {
    this.pan *= Math.exp(-dt * 0.35);
    const lead = speed * 0.45;
    this.x += (targetX + lead + this.pan - this.x) * damp(2.2, dt);
    const tilt = THREE.MathUtils.degToRad(WORLD.camTiltDeg);
    const sway = Math.sin(time * 0.6) * 0.04 + Math.sin(time * 1.37) * 0.015;
    const c = this.camera;
    // On narrow (portrait-ish) screens, pull back so the train still fits.
    const fit = Math.max(1, 1.5 / Math.max(0.6, c.aspect));
    const d = WORLD.camDist * fit;
    c.position.set(this.x + sway * 0.6, WORLD.focusY + Math.sin(tilt) * d + sway * 0.3, Math.cos(tilt) * d);
    c.rotation.set(-tilt, 0, Math.sin(time * 0.45) * 0.0025);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
