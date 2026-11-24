import * as THREE from 'three';

export interface TileLayerOpts {
  /** Tile width in world units. Must be ≥ the visible width at this depth. */
  width: number;
  height: number;
  /** World position of the tile's bottom edge (vertical) or centre (horizontal). */
  y: number;
  z: number;
  textures: THREE.Texture[];
  /** Horizontal = lies on the ground (rotated to face up). */
  horizontal?: boolean;
  fog?: boolean;
  renderOrder?: number;
  /** Apply a material customisation (e.g. sway shader) to each tile. */
  material?: (tex: THREE.Texture) => THREE.Material;
}

/**
 * A horizontally repeating scenery strip made of 3 recycled planes.
 * Parallax is not faked: tiles are fixed in world space at their Z depth and
 * only recycled when they leave the view, so the perspective camera produces
 * the depth motion.
 */
export class TileLayer {
  readonly group = new THREE.Group();
  private readonly tiles: THREE.Mesh[] = [];
  private readonly mats: THREE.Material[];

  constructor(private readonly o: TileLayerOpts) {
    const geo = new THREE.PlaneGeometry(o.width, o.height);
    if (o.horizontal) geo.rotateX(-Math.PI / 2);
    else geo.translate(0, o.height / 2, 0);
    this.mats = o.textures.map(
      (map) =>
        o.material?.(map) ??
        new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.02, fog: o.fog ?? true }),
    );
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(geo, this.mats[0]);
      m.position.set(0, o.y, o.z);
      m.renderOrder = o.renderOrder ?? 0;
      m.frustumCulled = false;
      this.tiles.push(m);
      this.group.add(m);
    }
  }

  update(camX: number): void {
    const { width } = this.o;
    const k = Math.floor(camX / width + 0.5);
    const n = this.mats.length;
    for (let i = 0; i < 3; i++) {
      const idx = k + i - 1;
      const t = this.tiles[i];
      if (!t) continue;
      t.position.x = idx * width;
      t.material = this.mats[((idx % n) + n) % n] as THREE.Material;
    }
  }
}
