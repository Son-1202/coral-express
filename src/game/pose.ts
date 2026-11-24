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

export function trainPose(s: SimState, legSeconds: number, stopSeconds: number): TrainPose {
  const tr = s.train;
  const base = s.lifetime.arrivals % ODO_WRAP;
  if (tr.phase === 'stopped') {
    return { odo: base, vel: 0, phase: 'stopped', progress: 0, eta: Math.max(0, stopSeconds - tr.t) + legSeconds };
  }
  const u = Math.min(1, Math.max(0, tr.t / legSeconds));
  const p = legProfile(u);
  return { odo: base + p.pos, vel: p.vel / legSeconds, phase: 'moving', progress: u, eta: Math.max(0, legSeconds - tr.t) };
}
