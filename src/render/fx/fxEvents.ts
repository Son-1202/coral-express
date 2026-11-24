import * as THREE from 'three';
import type { SimEvent } from '../../sim';
import { formatNumber } from '../../util/format';
import type { Stage } from '../stage';
import { bubbleTex, coinTex, confettiTex, flakeTex, heartBubbleTex, softTex, sparkleTex, splashTex } from './paintFx';

/** Maps sim events to visible effects (B4.6–B4.8, T-13 deliverable 5). */
export class FxEvents {
  private readonly v = new THREE.Vector3();
  /** carId → seconds of food flakes left. */
  private readonly feeding = new Map<string, number>();
  private shinyTimer = 0;
  private requestSprites = new Map<string, number>();

  constructor(private readonly s: Stage) {
    for (const r of s.game.story.requests) this.requestSprites.set(r.id, r.passenger.sprite);
  }

  private carPos(carId: string | undefined): THREE.Vector3 | null {
    if (!carId) return null;
    return this.s.train.carWorld(carId, new THREE.Vector3());
  }

  handle(e: SimEvent): void {
    const s = this.s;
    const P = s.particles;
    switch (e.type) {
      case 'purchase': {
        s.syncState();
        const at = (e.fishId && s.train.fishWorld(e.fishId)) || this.carPos(e.carId);
        if (e.item === 'fish' && e.fishId) {
          const f = s.train.findFish(e.fishId);
          f?.fish.dropIn();
          const c = this.carPos(f?.car.id ?? e.carId);
          if (c && f) {
            const top = c.y + f.car.winH / 2 - 0.05;
            for (let i = 0; i < 6; i++)
              P.spawn({ tex: splashTex(), x: c.x + f.fish.mesh.position.x + (Math.random() - 0.5) * 0.3, y: top, z: c.z + 0.3, vy: 0.8 + Math.random(), g: -4, life: 0.6, size: 0.16, aspect: 1.6 });
            this.bubbles(c, 8);
          }
          if (e.shiny && at) {
            P.burst(sparkleTex(), at, 22, { speed: 2.5, size: 0.16 });
            s.passengers.cheer();
          }
        } else if (at) {
          this.bubbles(at, 10);
          P.burst(bubbleTex(), at, 8, { speed: 1, g: 1.5, size: 0.12 });
        }
        break;
      }
      case 'levelUp': {
        const f = s.train.findFish(e.fishId);
        f?.fish.pulse(1);
        const at = s.train.fishWorld(e.fishId);
        if (at) {
          P.burst(sparkleTex(), at, 8 + Math.min(10, e.levels), { speed: 1.4, size: 0.12 });
          s.coins.pop(at, `Lv ${e.level}`);
        }
        break;
      }
      case 'milestone': {
        const at = s.train.fishWorld(e.fishId);
        s.train.findFish(e.fishId)?.fish.pulse(1.5);
        if (at) {
          P.spawn({ tex: softTex(), x: at.x, y: at.y, z: at.z + 0.3, life: 0.5, size: 0.4, sizeEnd: 2.2, additive: true, color: '#fff3c0' });
          P.burst(sparkleTex(), at, 30, { speed: 3.2, size: 0.18 });
          P.burst(confettiTex(1), at, 14, { speed: 2.5, size: 0.08, aspect: 1.5 });
        }
        s.rig.nudge(1);
        break;
      }
      case 'bondFormed': {
        s.bonds.pop(e.carId, e.fishIds);
        const c = this.carPos(e.carId);
        if (c) P.burst(heartBubbleTex(), c, e.kind === 'community' ? 12 : 7, { speed: 1.4, g: 1.2, size: 0.18, sizeEnd: 0.1 });
        s.passengers.cheer();
        break;
      }
      case 'frenzy': {
        this.feeding.set(e.carId, s.game.data.config.frenzy.seconds);
        const car = s.train.car(e.carId);
        if (car) for (const f of car.fish.values()) { f.mover.attract((Math.random() - 0.5) * 0.6, 0.3, 2.5); f.pulse(0.3); }
        const c = this.carPos(e.carId);
        if (c) this.bubbles(c, 6);
        break;
      }
      case 'frenzyEnd':
        this.feeding.delete(e.carId);
        break;
      case 'arrive': {
        s.syncState();
        const stationX = Math.round(s.game.pose().odo) * 64;
        const doors = s.train.cars.map((c) => s.doorX(c.id)).filter((x): x is number => x !== null);
        s.passengers.arrive(stationX, doors.length ? doors : [stationX], 2 + (s.game.sim.state.lifetime.arrivals % 4), s.game.sim.state.lifetime.arrivals * 97 + 11);
        break;
      }
      case 'depart':
        s.passengers.depart();
        break;
      case 'fare': {
        const pts = s.train.cars.map((c) => s.train.carWorld(c.id)).filter((p): p is THREE.Vector3 => !!p);
        s.coins.fly(pts.slice(0, 8), pts.length > 4 ? 1 : 2, `+${formatNumber(e.amount)}`);
        for (const p of pts) P.burst(coinTex(), p, 3, { speed: 1.5, size: 0.14, sizeEnd: 0.1 });
        break;
      }
      case 'requestCompleted': {
        const door = s.doorX(e.carId);
        const odo = Math.round(s.game.pose().odo) * 64;
        if (door !== null) s.passengers.visitor(this.requestSprites.get(e.requestId) ?? 1, odo - 6, door);
        s.passengers.cheer();
        const c = this.carPos(e.carId);
        if (c) s.coins.fly([c], 4, `+${formatNumber(e.shells)}`);
        break;
      }
      case 'sightStart':
        s.sights.start(e.sightId);
        break;
      case 'sightEnd': {
        s.sights.end(e.sightId, e.tapped);
        if (e.shells > 0) s.coins.fly([new THREE.Vector3(s.rig.focusX, 1.5, 0)], 5, `+${formatNumber(e.shells)}`);
        if (e.fishId) {
          s.syncState();
          s.train.findFish(e.fishId)?.fish.dropIn();
          s.passengers.cheer();
        }
        if (e.sightId === 'festival_station') {
          for (let i = 0; i < 40; i++)
            P.spawn({ tex: confettiTex(i), x: s.rig.focusX + (Math.random() - 0.5) * 14, y: 4 + Math.random() * 2, z: 0.5, vx: (Math.random() - 0.5), vy: -0.5, g: -0.6, life: 3.5, size: 0.08, aspect: 1.5, spin: 5, wobble: 0.2 });
        }
        break;
      }
      case 'stamp':
        if (e.kind === 'shiny') s.passengers.cheer();
        break;
      case 'fishMoved':
      case 'sale':
      case 'lineOpened':
      case 'depotReset':
        s.syncState();
        break;
      default:
        break;
    }
  }

  itemLanded(at: THREE.Vector3): void {
    this.s.particles.burst(sparkleTex(), at, 10, { speed: 1.6, size: 0.12 });
    this.bubbles(at, 8);
  }

  private bubbles(at: THREE.Vector3, n: number): void {
    for (let i = 0; i < n; i++)
      this.s.particles.spawn({ tex: bubbleTex(), x: at.x + (Math.random() - 0.5) * 1.6, y: at.y - 0.25, z: at.z + 0.2, vy: 0.5 + Math.random() * 0.5, life: 0.9 + Math.random() * 0.5, size: 0.06 + Math.random() * 0.05, wobble: 0.04 });
  }

  update(dt: number): void {
    const s = this.s;
    // food flakes drifting down during a frenzy
    for (const [carId, left] of this.feeding) {
      const l = left - dt;
      if (l <= 0) {
        this.feeding.delete(carId);
        continue;
      }
      this.feeding.set(carId, l);
      const car = s.train.car(carId);
      const c = this.carPos(carId);
      if (!car || !c || Math.random() > dt * 10) continue;
      s.particles.spawn({ tex: flakeTex(), x: c.x + (Math.random() - 0.5) * car.winW * 0.9, y: c.y + car.winH / 2 - 0.06, z: c.z + 0.05, vy: -0.12, life: 2.2, size: 0.045, aspect: 1.5, spin: 1.5, wobble: 0.03 });
    }
    // shiny fish twinkle
    this.shinyTimer -= dt;
    if (this.shinyTimer <= 0) {
      this.shinyTimer = 0.25;
      for (const car of s.train.cars)
        for (const f of car.fish.values()) {
          if (!f.shiny || Math.random() > 0.5) continue;
          const p = f.mesh.getWorldPosition(this.v);
          s.particles.spawn({ tex: sparkleTex(), x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + (Math.random() - 0.5) * 0.2, z: p.z + 0.1, life: 0.6, size: 0.1, sizeEnd: 0.01, spin: 3 });
        }
    }
  }
}
