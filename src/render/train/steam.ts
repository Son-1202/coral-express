import * as THREE from 'three';
import { toTexture } from '../paint/canvas';
import { paintPuff } from './paintTrain';

interface Puff {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  age: number;
  vx: number;
  vy: number;
}

/** Steam puffs from the chimney; emission rate grows with speed. World-space so they trail behind. */
export class Steam {
  readonly group = new THREE.Group();
  private readonly puffs: Puff[] = [];
  private acc = 0;
  private next = 0;

  constructor(count = 28) {
    const tex = toTexture(paintPuff());
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.puffs.push({ mesh, mat, life: 1, age: 1, vx: 0, vy: 0 });
    }
  }

  update(dt: number, origin: THREE.Vector3, speed: number): void {
    const rate = 1.2 + speed * 2.2; // puffs per second
    this.acc += dt * rate;
    while (this.acc >= 1) {
      this.acc -= 1;
      const p = this.puffs[this.next];
      this.next = (this.next + 1) % this.puffs.length;
      if (!p) continue;
      p.age = 0;
      p.life = 1.8 + Math.random() * 1.2;
      p.vx = -speed * 0.35 - 0.1 + Math.random() * 0.15;
      p.vy = 0.5 + Math.random() * 0.25;
      p.mesh.position.set(origin.x, origin.y, origin.z + 0.05);
      p.mesh.visible = true;
    }
    for (const p of this.puffs) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt * (1 - k * 0.6);
      const s = 0.32 + k * 1.3;
      p.mesh.scale.set(s, s, 1);
      p.mat.opacity = Math.min(1, k * 6) * (1 - k) * 0.95;
    }
  }
}
