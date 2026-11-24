import * as THREE from 'three';
import { Diorama } from './diorama/diorama';
import { CameraRig } from './diorama/cameraRig';
import { WORLD } from './diorama/config';
import { Train } from './train/train';
import { TrainMotion } from './train/motion';
import { Post, FpsGuard, type Quality } from './post/post';

export interface StageOpts {
  legSeconds: number;
  stopSeconds: number;
  quality: Quality | 'auto';
}

/** Owns renderer, scene, camera, train and post stack; advanced once per animation frame. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly diorama = new Diorama();
  readonly rig: CameraRig;
  readonly train = new Train(3);
  readonly motion: TrainMotion;
  readonly post: Post;
  private readonly guard: FpsGuard;
  /** Index into train.parts the camera follows (0 = locomotive). */
  follow = 2;
  time = 0;

  constructor(canvas: HTMLCanvasElement, o: StageOpts) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.motion = new TrainMotion({ spacing: WORLD.stationSpacing, legSeconds: o.legSeconds, stopSeconds: o.stopSeconds });
    const scene = this.diorama.scene;
    this.train.group.position.set(0, 0.2, 0.1);
    scene.add(this.train.group, this.train.steam.group);
    this.post = new Post(this.renderer, scene, this.rig.camera);
    if (o.quality !== 'auto') this.post.setQuality(o.quality);
    this.guard = new FpsGuard(() => {
      if (o.quality === 'auto') this.post.setQuality('low');
    });
    this.rig.snap(this.followX());
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private followX(): number {
    return this.train.group.position.x + (this.train.centers[this.follow] ?? 0);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.rig.resize(w / h);
  }

  /** Advance animation only (no rendering) — used for warm-up/fast-forward. */
  step(dt: number): void {
    this.time += dt;
    this.motion.update(dt);
    this.train.group.position.x = this.motion.x;
    this.train.update(dt, this.time, this.motion.vel, this.motion.accel);
    this.rig.update(dt, this.time, this.followX(), this.motion.vel);
  }

  frame(dt: number): void {
    this.guard.tick(dt);
    this.step(dt);
    this.diorama.update(this.time, this.rig.camera);
    this.post.render(dt);
  }
}
