import { legProfile } from '../render/anim/ease';
import type { SimState } from '../sim';

/**
 * Visual train pose derived from the sim's shuttle state.
 *
 * Presentation choice (T-13): the sim shuttles 1→6→1, but on screen the train
 * ALWAYS heads right with the locomotive in front. The world is an endless coast
 * and `odo` is a monotonic odometer in legs: every arrival adds one platform.
 * Station signs show the real sim station names, so the journey reads correctly
 * while the camera never has to flip.
 */
export interface TrainPose {
  /** Odometer in legs (platform k sits at odo = k). Wrapped to keep floats small. */
  odo: number;
  /** Leg-lengths per second. */
  vel: number;
  phase: 'moving' | 'stopped';
  /** 0..1 progress of the current leg (0 while stopped). */
  progress: number;
  /** Seconds to the next arrival. */
  eta: number;
}

/** Odometer wraps every N legs (float precision in shaders); the view snaps on wrap. */
export const ODO_WRAP = 512;

/**
 * @param ahead sim seconds not yet consumed by a fixed tick (`state.tickAcc`). The sim
 * only steps the train every 0.25 s tick; adding the leftover here makes the visual
 * pose a continuous function of time that equals the sim exactly at every tick
 * boundary (T-25: no 4 Hz stepping). Phase ends inside `ahead` are resolved the same
 * way the sim will resolve them on the next tick.
 */
export function trainPose(s: SimState, legSeconds: number, stopSeconds: number, ahead = 0): TrainPose {
  const tr = s.train;
  const base = s.lifetime.arrivals % ODO_WRAP;
  const t = tr.t + Math.max(0, ahead);
  if (tr.phase === 'stopped') {
    if (t <= stopSeconds || ahead <= 0) {
      return { odo: base, vel: 0, phase: 'stopped', progress: 0, eta: Math.max(0, stopSeconds - t) + legSeconds };
    }
    return moving(base, t - stopSeconds, legSeconds);
  }
  if (t >= legSeconds) {
    // arrived during the sub-tick: rest on the next platform until the sim catches up
    return { odo: base + 1, vel: 0, phase: 'stopped', progress: 0, eta: stopSeconds - (t - legSeconds) + legSeconds };
  }
  return moving(base, t, legSeconds);
}

function moving(base: number, t: number, legSeconds: number): TrainPose {
  const u = Math.min(1, Math.max(0, t / legSeconds));
  const p = legProfile(u);
  return { odo: base + p.pos, vel: p.vel / legSeconds, phase: 'moving', progress: u, eta: Math.max(0, legSeconds - t) };
}
