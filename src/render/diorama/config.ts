/**
 * Diorama geometry (world units ≈ toy-model metres). Render layout only —
 * no game balance lives here.
 */
export const WORLD = {
  fov: 22,
  /** Camera distance and height relative to the train's focus point. */
  camDist: 23,
  camTiltDeg: 4,
  focusY: 1.55,
  seaY: -2.5,
  groundY: 0,
  nearGroundY: -0.9,
  trackFrontZ: 1.3,
  trackBackZ: -1.0,
  vergeBackZ: -3.0,
  /** Distance between station platforms along X. */
  stationSpacing: 64,
  platformLength: 13,
} as const;

/** Z depth of each vertical scenery layer (true parallax comes from this). */
export const LAYER_Z = {
  sky: -420,
  far: -170,
  midFar: -60,
  midNear: -26,
  verge: -3.1,
  station: -2.3,
  track: 0,
  near: 3.6,
  nearFront: 7.5,
} as const;

/** T-24: rail head height above the track bed; the train's wheels stand on it (stage.ts sets train y = RAIL_TOP). */
export const RAIL_TOP = 0.2;
/** T-24: Z of the side-on rail strip — just in front of the train (z 0.1) and its wheel sprites. */
export const RAIL_Z = 0.17;
