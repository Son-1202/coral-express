import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  KernelSize,
  NoiseEffect,
  RenderPass,
  TiltShiftEffect,
  VignetteEffect,
} from 'postprocessing';
import { GradeEffect, gradeAt } from './gradeEffect';

export type Quality = 'high' | 'low';

/**
 * T-28 (producer: "soften it"): wide sharp band from the pole tops / station roofs down to the
 * first foreground row; only the sky's top edge and the bottom lens foliage go soft.
 * Mask units are screen height in [-1, 1] (bottom → top): sharp in offset ± (focusArea − feather),
 * fully blurred beyond offset ± focusArea.
 */
const TILT = { focusArea: 0.9, feather: 0.3, offset: 0.05 } as const;
const TILT_KERNEL = { high: KernelSize.SMALL, low: KernelSize.VERY_SMALL } as const;
/** Film grain opacity (High only); was 0.08, −40% so it stops reading as screen noise on phones. */
const GRAIN = 0.048;

/** HD-2D post stack: tilt-shift DoF → bloom + grade + vignette + grain. */
export class Post {
  readonly composer: EffectComposer;
  private readonly tilt: TiltShiftEffect;
  private readonly bloom: BloomEffect;
  private readonly noise: NoiseEffect;
  private readonly grade = new GradeEffect();
  quality: Quality = 'high';

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));
    this.tilt = new TiltShiftEffect({ ...TILT, kernelSize: TILT_KERNEL.high });
    this.bloom = new BloomEffect({ intensity: 0.55, luminanceThreshold: 0.78, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.7 });
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
    this.noise = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: false });
    this.noise.blendMode.opacity.value = GRAIN;
    this.composer.addPass(new EffectPass(camera, this.tilt));
    this.composer.addPass(new EffectPass(camera, this.bloom, this.grade, vignette, this.noise));
    this.setTimeOfDay(0.3);
  }

  /** t ∈ [0,1): 0 morning, .25 afternoon, .5 dusk, .75 night (pure colour grade). */
  setTimeOfDay(t: number): void {
    this.grade.set(gradeAt(t));
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const high = q === 'high';
    this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
    this.tilt.blurPass.kernelSize = TILT_KERNEL[q];
    this.bloom.blendMode.opacity.value = high ? 1 : 0;
    this.noise.blendMode.opacity.value = high ? GRAIN : 0;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}

/** Drops to Low when the average FPS stays under `min` for `seconds`. */
export class FpsGuard {
  private below = 0;
  private frames = 0;
  private acc = 0;
  fps = 60;

  constructor(
    private readonly onDrop: () => void,
    private readonly min = 45,
    private readonly seconds = 3,
  ) {}

  tick(dt: number): void {
    this.frames++;
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.fps = this.frames / this.acc;
    if (this.fps < this.min) this.below += this.acc;
    else this.below = 0;
    this.frames = 0;
    this.acc = 0;
    if (this.below >= this.seconds) {
      this.below = -Infinity; // fire once
      this.onDrop();
    }
  }
}
