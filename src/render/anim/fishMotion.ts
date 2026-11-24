import type { MotionProfile } from '../../data/schema';
import { rng } from '../paint/canvas';

/**
 * Procedural fish motion profiles (SPEC C). Pure maths, no Three.js: a mover
 * works in normalised tank space x,y ∈ [-0.5, 0.5] (y up, floor at -0.5) and
 * returns a pose the sprite layer applies. Deterministic per seed.
 */
export interface FishPose {
  x: number;
  y: number;
  /** +1 facing right, -1 left (eased through 0 for the mirror-squash turn). */
  facing: number;
  /** Body rotation (radians). */
  rot: number;
  /** Squash/stretch multipliers. */
  sx: number;
  sy: number;
  /** Tail wobble frequency for the vertex shader (Hz-ish). */
  wobble: number;
}

export interface Mover {
  readonly profile: MotionProfile;
  pose: FishPose;
  /** Push target (food, slosh) — fish drift toward it for a moment. */
  attract(x: number, y: number, seconds: number): void;
  update(dt: number, time: number, slosh: number): FishPose;
}

/** Half-extents the sprite centre must stay inside (sprite half size in tank units). */
export interface Bounds {
  hx: number;
  hy: number;
}

const clampTo = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));

export function createMover(profile: MotionProfile, seed: number, b: Bounds): Mover {
  const r = rng(seed * 7919 + 13);
  const lx = Math.max(0.02, 0.5 - b.hx);
  const ly = Math.max(0.02, 0.5 - b.hy);
  const floorY = -0.5 + b.hy + 0.04;
  const pose: FishPose = { x: (r() - 0.5) * 2 * lx, y: (r() - 0.5) * ly, facing: r() < 0.5 ? 1 : -1, rot: 0, sx: 1, sy: 1, wobble: 4 };
  if (profile === 'crawler' || profile === 'sessile' || profile === 'hopper') pose.y = floorY;
  let tx = pose.x;
  let ty = pose.y;
  let vx = 0;
  let vy = 0;
  let timer = r() * 2;
  let hop = 0;
  let attractT = 0;
  let ax = 0;
  let ay = 0;
  const phase = r() * 10;
  const speed = 0.7 + r() * 0.6;

  const pickTarget = (yMin: number, yMax: number) => {
    tx = (r() - 0.5) * 2 * lx;
    ty = yMin + r() * (yMax - yMin);
  };

  const face = (dirX: number, dt: number) => {
    if (Math.abs(dirX) < 1e-3) return;
    const want = dirX > 0 ? 1 : -1;
    pose.facing += (want - pose.facing) * Math.min(1, dt * 7);
  };

  const steer = (accel: number, maxV: number, damping: number, dt: number) => {
    let gx = tx;
    let gy = ty;
    if (attractT > 0) {
      gx = ax;
      gy = ay;
    }
    const dx = gx - pose.x;
    const dy = gy - pose.y;
    const d = Math.hypot(dx, dy) || 1;
    vx += (dx / d) * accel * dt;
    vy += (dy / d) * accel * dt;
    vx *= Math.exp(-damping * dt);
    vy *= Math.exp(-damping * dt);
    const v = Math.hypot(vx, vy);
    if (v > maxV) {
      vx *= maxV / v;
      vy *= maxV / v;
    }
    pose.x += vx * dt;
    pose.y += vy * dt;
    return d;
  };

  const mover: Mover = {
    profile,
    pose,
    attract(x, y, seconds) {
      ax = clampTo(x, lx);
      ay = clampTo(y, ly);
      attractT = seconds;
    },
    update(dt, time, slosh) {
      attractT = Math.max(0, attractT - dt);
      timer -= dt;
      pose.rot = 0;
      pose.sx = 1;
      pose.sy = 1;
      switch (profile) {
        case 'darter': {
          // boids-lite wander with bursts; wobble ∝ speed
          if (timer <= 0) {
            pickTarget(-ly * 0.8, ly * 0.9);
            timer = 0.8 + r() * 2.2;
          }
          const burst = timer > 0.5 ? 1 : 0.4;
          steer(1.6 * speed * burst, 0.55 * speed, 1.8, dt);
          face(vx, dt);
          pose.wobble = 4 + Math.hypot(vx, vy) * 22;
          pose.rot = clampTo(vy * 0.8, 0.35) * Math.sign(pose.facing || 1);
          break;
        }
        case 'hoverer': {
          if (timer <= 0) {
            pickTarget(-ly * 0.4, ly * 0.8);
            timer = 3 + r() * 3;
          }
          steer(0.25 * speed, 0.12, 1.2, dt);
          pose.y += Math.sin(time * 1.3 + phase) * 0.0015;
          face(tx - pose.x, dt * 0.5);
          pose.wobble = 9;
          pose.rot = Math.sin(time * 1.1 + phase) * 0.06;
          break;
        }
        case 'glider': {
          // long slow arcs from wall to wall
          const t = time * 0.12 * speed + phase;
          const nx = Math.sin(t) * lx;
          const ny = Math.sin(t * 2.3 + phase) * ly * 0.6;
          face(nx - pose.x, dt);
          pose.x = attractT > 0 ? pose.x + (ax - pose.x) * dt : nx;
          pose.y = attractT > 0 ? pose.y + (ay - pose.y) * dt : ny;
          pose.rot = Math.cos(t * 2.3 + phase) * 0.12 * Math.sign(pose.facing || 1);
          pose.sy = 1 + Math.sin(time * 2.2 + phase) * 0.06;
          pose.wobble = 2;
          break;
        }
        case 'sinuous': {
          const t = time * 0.2 * speed + phase;
          const nx = Math.sin(t) * lx;
          face(Math.cos(t), dt);
          pose.x = nx;
          pose.y = Math.sin(t * 1.7) * ly * 0.5;
          pose.rot = Math.sin(time * 3 + phase) * 0.1;
          pose.wobble = 6;
          break;
        }
        case 'crawler': {
          // floor-locked short hops with a claw-snap squash
          pose.y = floorY;
          if (timer <= 0) {
            tx = clampTo(pose.x + (r() - 0.5) * 0.5, lx);
            timer = 1 + r() * 2.5;
            hop = 0.35;
          }
          const dx = tx - pose.x;
          pose.x += clampTo(dx, 0.12 * dt * 4);
          face(dx, dt);
          if (hop > 0) {
            hop -= dt;
            const k = Math.sin((1 - hop / 0.35) * Math.PI);
            pose.y += k * 0.06;
            pose.sy = 1 + k * 0.08;
            pose.sx = 1 - k * 0.05;
          } else {
            const snap = Math.pow(Math.max(0, Math.sin(time * 2.1 + phase)), 30);
            pose.sx = 1 + snap * 0.12;
            pose.sy = 1 - snap * 0.1;
          }
          pose.wobble = 0;
          break;
        }
        case 'hopper': {
          // mudskipper: hops along the floor, sometimes sticks to the glass
          if (timer <= 0) {
            tx = clampTo(pose.x + (r() - 0.5) * 0.7, lx);
            timer = 1.6 + r() * 2;
            hop = 0.6;
          }
          if (hop > 0) {
            hop -= dt;
            const u = 1 - hop / 0.6;
            pose.x += (tx - pose.x) * Math.min(1, dt * 5);
            pose.y = floorY + Math.sin(u * Math.PI) * 0.35;
            pose.sy = 1 + Math.sin(u * Math.PI) * 0.15;
            face(tx - pose.x, dt * 2);
          } else {
            pose.y = floorY;
            pose.sy = 1 - Math.pow(Math.max(0, Math.sin(time * 4 + phase)), 20) * 0.08;
          }
          pose.wobble = 3;
          break;
        }
        case 'pulser': {
          // squash-stretch jet; drifts down, then jets upward
          const cyc = (time * 0.6 * speed + phase) % 1;
          const jet = cyc < 0.2 ? Math.sin((cyc / 0.2) * Math.PI) : 0;
          pose.y += (jet * 0.5 - 0.06) * dt;
          if (pose.y < -ly * 0.7) pose.y += 0.4 * dt;
          if (timer <= 0) {
            tx = (r() - 0.5) * 2 * lx;
            timer = 3 + r() * 3;
          }
          pose.x += (tx - pose.x) * dt * 0.25;
          pose.sx = 1 - jet * 0.18;
          pose.sy = 1 + jet * 0.25;
          face(tx - pose.x, dt * 0.3);
          pose.wobble = 7;
          break;
        }
        case 'swarm': {
          // centre of a krill cloud: lazy figure-eight
          const t = time * 0.35 * speed + phase;
          pose.x = Math.sin(t) * lx * 0.8;
          pose.y = Math.sin(t * 2) * ly * 0.4;
          face(Math.cos(t), dt);
          pose.wobble = 10;
          break;
        }
        case 'sessile': {
          pose.y = floorY;
          pose.rot = Math.sin(time * 1.1 + phase) * 0.05;
          pose.sx = 1 + Math.sin(time * 0.9 + phase) * 0.04;
          pose.sy = 1 + Math.sin(time * 0.9 + phase + 1) * 0.05;
          pose.wobble = 0;
          break;
        }
      }
      // signature slosh: free swimmers drift with the water for a moment
      if (profile !== 'sessile' && profile !== 'crawler') pose.x -= slosh * 0.08 * dt * 10;
      pose.x = clampTo(pose.x, lx);
      pose.y = Math.max(-0.5 + b.hy, Math.min(ly, pose.y));
      return pose;
    },
  };
  return mover;
}
