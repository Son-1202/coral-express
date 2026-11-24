import * as THREE from 'three';
import { toTexture } from '../paint/canvas';
import { SUNNY } from '../paint/palette';
import { WORLD, LAYER_Z } from './config';
import { TileLayer } from './tileLayer';
import { createSea } from './sea';
import { paintSky, paintClouds } from './paintSky';
import { paintFar } from './paintFar';
import { paintMidFar, paintMidNear } from './paintMid';
import { paintTrackBed, paintRailSide, paintWall, paintGrass } from './paintTrack';
import { paintNear, paintNearFront, paintVergeBack } from './paintNear';
import { buildLineArt, hasLineArt } from './lineArt';
import { StationView } from './station';

function aspectH(canvas: HTMLCanvasElement, w: number): number {
  return (w * canvas.height) / canvas.width;
}

/** Fog per line (Fjords are thicker, SPEC C). Render mood only. */
const LINE_FOG: Record<number, { color: string; near: number; far: number }> = {
  1: { color: '#e9efe6', near: 70, far: 520 },
  2: { color: '#c9d6dc', near: 30, far: 260 },
  3: { color: '#e6ddd2', near: 60, far: 420 },
};

/**
 * The side-on coastal diorama. Real per-Line scenery art (`scenery/l<n>_*`)
 * replaces the procedural sky/sea/cliffs when present; the procedural track,
 * wall and garden always stay. Platforms repeat every `stationSpacing`.
 */
export class Diorama {
  readonly scene = new THREE.Scene();
  private readonly common: TileLayer[] = [];
  /** Procedural backdrop (used for a line without art). */
  private readonly proc = new THREE.Group();
  private readonly procLayers: TileLayer[] = [];
  private readonly sky: THREE.Mesh;
  private readonly clouds: THREE.Mesh;
  private readonly cloudTex: THREE.Texture;
  private readonly sea: ReturnType<typeof createSea>;
  readonly stations: StationView[] = [];
  private readonly lineSets = new Map<number, { group: THREE.Group; layers: TileLayer[] }>();
  private line = 0;
  private readonly fog: THREE.Fog;
  private fogMult = 1;
  private fogTarget = 1;
  /** Fog veil in front of the far layers (Sea Fog sight, Fjord mist). */
  private readonly veil: THREE.Mesh;
  private readonly veilMat: THREE.MeshBasicMaterial;
  /** Station sign name per odometer slot. */
  nameForSlot: (slot: number) => string = () => '';

  constructor() {
    const s = this.scene;
    s.background = new THREE.Color(SUNNY.skyMid);
    this.fog = new THREE.Fog(new THREE.Color('#e9efe6'), 70, 520);
    s.fog = this.fog;
    s.add(this.proc);

    const skyTex = toTexture(paintSky());
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(560, 260), new THREE.MeshBasicMaterial({ map: skyTex, fog: false }));
    this.sky.renderOrder = -10;
    this.proc.add(this.sky);
    this.cloudTex = toTexture(paintClouds(7));
    this.cloudTex.wrapS = THREE.RepeatWrapping;
    this.cloudTex.repeat.set(1.6, 1);
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(540, 90),
      new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, depthWrite: false, fog: false }),
    );
    this.clouds.renderOrder = -9;
    this.proc.add(this.clouds);
    this.sea = createSea(WORLD.seaY);
    this.proc.add(this.sea.mesh);

    const far = paintFar(21);
    this.addProc({ width: 200, height: aspectH(far, 200), y: WORLD.seaY - 0.5, z: LAYER_Z.far, textures: [toTexture(far), toTexture(paintFar(22))] });
    const mf = paintMidFar(31);
    this.addProc({ width: 84, height: aspectH(mf, 84), y: WORLD.seaY - 0.4, z: LAYER_Z.midFar, textures: [toTexture(mf), toTexture(paintMidFar(32))] });
    const mn = paintMidNear(41);
    this.addProc({ width: 46, height: aspectH(mn, 46), y: WORLD.seaY - 0.3, z: LAYER_Z.midNear, textures: [toTexture(mn), toTexture(paintMidNear(42))] });
    this.addProc({ width: 24, height: 1.6, y: WORLD.groundY - 0.6, z: LAYER_Z.verge, textures: [toTexture(paintVergeBack(52), true)] });

    // cliff-edge verge behind the track
    const vergeDepth = WORLD.trackBackZ - WORLD.vergeBackZ;
    this.add({ width: 24, height: vergeDepth + 0.2, y: WORLD.groundY - 0.01, z: (WORLD.trackBackZ + WORLD.vergeBackZ) / 2, horizontal: true, textures: [toTexture(paintGrass(51, 24, 3, false))] });
    // track bed, front rail, embankment wall
    const bedDepth = WORLD.trackFrontZ - WORLD.trackBackZ;
    this.add({ width: 24, height: bedDepth, y: WORLD.groundY, z: (WORLD.trackFrontZ + WORLD.trackBackZ) / 2, horizontal: true, textures: [toTexture(paintTrackBed(61), true)] });
    this.add({ width: 24, height: 0.25, y: -0.03, z: 0.56, textures: [toTexture(paintRailSide(), true)], renderOrder: 2 });
    this.add({ width: 24, height: 1.0, y: WORLD.nearGroundY - 0.1, z: WORLD.trackFrontZ, textures: [toTexture(paintWall(62), true)] });
    // near garden, fence strip and lens foliage
    this.add({ width: 24, height: 8, y: WORLD.nearGroundY, z: WORLD.trackFrontZ + 4, horizontal: true, textures: [toTexture(paintGrass(71, 24, 8, true))] });
    this.add({ width: 16, height: 3, y: WORLD.nearGroundY, z: LAYER_Z.near, textures: [toTexture(paintNear(72, 0), true), toTexture(paintNear(72, 1), true)] });
    this.add({ width: 14, height: 2, y: WORLD.nearGroundY - 0.2, z: LAYER_Z.nearFront, textures: [toTexture(paintNearFront(81)), toTexture(paintNearFront(82))] });

    this.veilMat = new THREE.MeshBasicMaterial({ color: '#e8eef0', transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.veil = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), this.veilMat);
    this.veil.renderOrder = 1;
    s.add(this.veil);

    for (let i = 0; i < 3; i++) {
      const st = new StationView(i);
      this.stations.push(st);
      s.add(st.group);
    }
    this.setLine(1);
    // repaint signs once the pixel webfont is ready
    void document.fonts?.load('600 26px "Pixelify Sans"').then(() => this.stations.forEach((st) => st.repaintSign()));
  }

  private add(o: ConstructorParameters<typeof TileLayer>[0]): void {
    const l = new TileLayer(o);
    this.common.push(l);
    this.scene.add(l.group);
  }

  private addProc(o: ConstructorParameters<typeof TileLayer>[0]): void {
    const l = new TileLayer(o);
    this.procLayers.push(l);
    this.proc.add(l.group);
  }

  get currentLine(): number {
    return this.line;
  }

  /** Swap scenery set + station art + mood fog for a Line. */
  setLine(line: number): void {
    if (line === this.line) return;
    this.line = line;
    const art = hasLineArt(line);
    if (art && !this.lineSets.has(line)) this.lineSets.set(line, buildLineArt(line, this.scene));
    for (const [l, set] of this.lineSets) set.group.visible = l === line;
    this.proc.visible = !art;
    for (const st of this.stations) st.setLine(line);
    const f = LINE_FOG[line] ?? LINE_FOG[1];
    if (f) this.fog.color.set(f.color);
    (this.scene.background as THREE.Color).set(art ? (f?.color ?? SUNNY.skyMid) : SUNNY.skyMid);
  }

  /** Sea Fog sight etc.: >1 = thicker fog (eased). */
  setFogMult(m: number): void {
    this.fogTarget = m;
  }

  update(time: number, camera: THREE.PerspectiveCamera, night = 0, dt = 1 / 60): void {
    const cx = camera.position.x;
    this.sky.position.set(cx, camera.position.y + 18, LAYER_Z.sky);
    this.clouds.position.set(cx, camera.position.y + 36, LAYER_Z.sky + 20);
    this.cloudTex.offset.x = time * 0.004 + cx * 0.0006;
    if (this.proc.visible) {
      this.sea.update(time, camera.position);
      for (const l of this.procLayers) l.update(cx);
    }
    for (const l of this.common) l.update(cx);
    const set = this.lineSets.get(this.line);
    if (set) for (const l of set.layers) l.update(cx);
    this.fogMult += (this.fogTarget - this.fogMult) * Math.min(1, dt * 0.8);
    const f = LINE_FOG[this.line] ?? LINE_FOG[1];
    if (f) {
      this.fog.near = f.near / this.fogMult;
      this.fog.far = f.far / Math.pow(this.fogMult, 1.6);
      this.veilMat.color.set(f.color);
    }
    const baseMist = this.line === 2 ? 0.12 : 0;
    this.veilMat.opacity = Math.min(0.8, baseMist + (this.fogMult - 1) * 0.3);
    this.veil.visible = this.veilMat.opacity > 0.01;
    this.veil.position.set(cx, camera.position.y - 4, -30);
    const sp = WORLD.stationSpacing;
    const k = Math.round(cx / sp);
    this.stations.forEach((st, i) => {
      const slot = k + i - 1;
      st.group.position.x = slot * sp;
      if (st.slot !== slot) {
        st.slot = slot;
      }
      st.setName(this.nameForSlot(slot));
      st.update(night);
    });
  }
}
