import * as THREE from 'three';
import { loadTexture } from '../../assets';
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
import { paintStationBuilding, paintPlatformFace, paintPlatformTop, STATION_BUILDING } from './paintStation';

function aspectH(canvas: HTMLCanvasElement, w: number): number {
  return (w * canvas.height) / canvas.width;
}

/** The side-on coastal diorama: sky, sea, cliffs, track, stations and foreground. */
export class Diorama {
  readonly scene = new THREE.Scene();
  private readonly layers: TileLayer[] = [];
  private readonly sky: THREE.Mesh;
  private readonly clouds: THREE.Mesh;
  private readonly cloudTex: THREE.Texture;
  private readonly sea: ReturnType<typeof createSea>;
  private readonly stations: THREE.Group[] = [];

  constructor() {
    const s = this.scene;
    s.background = new THREE.Color(SUNNY.skyMid);
    s.fog = new THREE.Fog(new THREE.Color('#e9efe6'), 70, 520);

    // sky follows the camera (infinitely far)
    const skyTex = loadTexture('scenery.l1.sky', paintSky);
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(560, 260), new THREE.MeshBasicMaterial({ map: skyTex, fog: false }));
    this.sky.position.z = LAYER_Z.sky;
    this.sky.renderOrder = -10;
    s.add(this.sky);
    this.cloudTex = toTexture(paintClouds(7));
    this.cloudTex.wrapS = THREE.RepeatWrapping;
    this.cloudTex.repeat.set(1.6, 1);
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(540, 90),
      new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, depthWrite: false, fog: false }),
    );
    this.clouds.position.z = LAYER_Z.sky + 20;
    this.clouds.renderOrder = -9;
    s.add(this.clouds);

    this.sea = createSea(WORLD.seaY);
    s.add(this.sea.mesh);

    const far = paintFar(21);
    const farB = paintFar(22);
    this.add({ width: 200, height: aspectH(far, 200), y: WORLD.seaY - 0.5, z: LAYER_Z.far, textures: [loadTexture('scenery.l1.far', () => far), toTexture(farB)] });
    const mf = paintMidFar(31);
    this.add({ width: 84, height: aspectH(mf, 84), y: WORLD.seaY - 0.4, z: LAYER_Z.midFar, textures: [loadTexture('scenery.l1.mid', () => mf), toTexture(paintMidFar(32))] });
    const mn = paintMidNear(41);
    this.add({ width: 46, height: aspectH(mn, 46), y: WORLD.seaY - 0.3, z: LAYER_Z.midNear, textures: [toTexture(mn), toTexture(paintMidNear(42))] });

    // cliff-edge verge behind the track
    const vergeDepth = WORLD.trackBackZ - WORLD.vergeBackZ;
    this.add({ width: 24, height: vergeDepth + 0.2, y: WORLD.groundY - 0.01, z: (WORLD.trackBackZ + WORLD.vergeBackZ) / 2, horizontal: true, textures: [toTexture(paintGrass(51, 24, 3, false))] });
    this.add({ width: 24, height: 1.6, y: WORLD.groundY - 0.6, z: LAYER_Z.verge, textures: [toTexture(paintVergeBack(52), true)] });

    // track bed, front rail, embankment wall
    const bedDepth = WORLD.trackFrontZ - WORLD.trackBackZ;
    this.add({ width: 24, height: bedDepth, y: WORLD.groundY, z: (WORLD.trackFrontZ + WORLD.trackBackZ) / 2, horizontal: true, textures: [toTexture(paintTrackBed(61), true)] });
    this.add({ width: 24, height: 0.25, y: -0.03, z: 0.56, textures: [toTexture(paintRailSide(), true)], renderOrder: 2 });
    this.add({ width: 24, height: 1.0, y: WORLD.nearGroundY - 0.1, z: WORLD.trackFrontZ, textures: [toTexture(paintWall(62), true)] });

    // near garden, fence strip and lens foliage
    this.add({ width: 24, height: 8, y: WORLD.nearGroundY, z: WORLD.trackFrontZ + 4, horizontal: true, textures: [toTexture(paintGrass(71, 24, 8, true))] });
    this.add({ width: 16, height: 3, y: WORLD.nearGroundY, z: LAYER_Z.near, textures: [loadTexture('scenery.l1.near', () => paintNear(72, 0), { pixel: true }), toTexture(paintNear(72, 1), true)] });
    this.add({ width: 14, height: 2, y: WORLD.nearGroundY - 0.2, z: LAYER_Z.nearFront, textures: [toTexture(paintNearFront(81)), toTexture(paintNearFront(82))] });

    for (let i = 0; i < 3; i++) this.stations.push(this.makeStation(i));
  }

  private add(o: ConstructorParameters<typeof TileLayer>[0]): void {
    const l = new TileLayer(o);
    this.layers.push(l);
    this.scene.add(l.group);
  }

  private makeStation(seed: number): THREE.Group {
    const g = new THREE.Group();
    const L = WORLD.platformLength;
    const ph = 0.42;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(L, ph), new THREE.MeshBasicMaterial({ map: toTexture(paintPlatformFace(), true) }));
    face.position.set(0, ph / 2 - 0.02, -0.72);
    const topGeo = new THREE.PlaneGeometry(L, 1.4);
    topGeo.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topGeo, new THREE.MeshBasicMaterial({ map: toTexture(paintPlatformTop(), true) }));
    top.position.set(0, ph - 0.02, -1.42);
    const bTex = loadTexture('scenery.l1.station', () => paintStationBuilding(90 + seed), { pixel: true });
    const b = new THREE.Mesh(
      new THREE.PlaneGeometry(STATION_BUILDING.w, STATION_BUILDING.h),
      new THREE.MeshBasicMaterial({ map: bTex, transparent: true, alphaTest: 0.5 }),
    );
    b.position.set(0, ph + STATION_BUILDING.h / 2 - 0.05, LAYER_Z.station);
    g.add(face, top, b);
    this.scene.add(g);
    return g;
  }

  update(time: number, camera: THREE.PerspectiveCamera): void {
    const cx = camera.position.x;
    this.sky.position.set(cx, camera.position.y + 18, LAYER_Z.sky);
    this.clouds.position.set(cx, camera.position.y + 36, LAYER_Z.sky + 20);
    this.cloudTex.offset.x = time * 0.004 + cx * 0.0006;
    this.sea.update(time, camera.position);
    for (const l of this.layers) l.update(cx);
    const sp = WORLD.stationSpacing;
    const k = Math.round(cx / sp);
    this.stations.forEach((st, i) => {
      st.position.x = (k + i - 1) * sp;
    });
  }
}
