import * as THREE from 'three';
import type { Particles } from '../fx/particles';
import { Roadside } from './props';
import { Wildlife } from './wildlife';
import { Clouds, FogBanks, GullFlock, VolcanoSmoke } from './sky';
import { swayTime } from './sway';

/** Cloud tint per Line (render mood only). */
const CLOUD_TINT: Record<number, string> = { 1: '#ffffff', 2: '#e4eaee', 3: '#fff1e2' };

/**
 * Living world (pillar 2): roadside props + swaying foliage, ambient wildlife,
 * distant gull flock, drifting clouds, Line 3 volcano smoke and Line 2 fog banks.
 * Purely cosmetic; driven by render time only.
 */
export class LivingWorld {
  readonly group = new THREE.Group();
  readonly roadside = new Roadside();
  readonly wildlife: Wildlife;
  readonly gulls = new GullFlock();
  readonly clouds = new Clouds();
  readonly smoke = new VolcanoSmoke();
  readonly fog = new FogBanks();
  private line = 0;

  constructor(particles?: Particles) {
    this.wildlife = new Wildlife(particles);
    this.group.add(this.roadside.group, this.wildlife.group, this.gulls.group, this.clouds.group, this.smoke.group, this.fog.group);
  }

  setLine(line: number): void {
    if (line === this.line) return;
    this.line = line;
    this.roadside.setLine(line);
    this.wildlife.setLine(line);
    this.smoke.group.visible = line === 3;
    this.fog.group.visible = line === 2;
    this.clouds.setTint(CLOUD_TINT[line] ?? '#ffffff');
  }

  update(dt: number, time: number, camera: THREE.PerspectiveCamera): void {
    swayTime.value = time;
    this.roadside.update(camera);
    this.wildlife.update(dt, time, camera);
    this.gulls.update(dt, time, camera);
    this.clouds.update(dt, camera);
    if (this.line === 3) this.smoke.update(dt, camera);
    if (this.line === 2) this.fog.update(dt, camera);
  }
}
