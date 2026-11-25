import * as THREE from 'three';

/** Shared clock for every sway material (seconds). */
export const swayTime = { value: 0 };

/**
 * Plant-sway sprite material (SPEC C): offsetX = sin(time×freq + worldX×0.7) × amp × y²,
 * on a FOOT_GEO plane (y = 0 at the root, 1 at the tip). Alpha cut-out, fog kept.
 */
export function swayMaterial(map: THREE.Texture, freq = 1.3, amp = 0.06): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ map, transparent: false, alphaTest: 0.5 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSwayT = swayTime;
    sh.uniforms.uSwayF = { value: freq };
    sh.uniforms.uSwayA = { value: amp };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSwayT; uniform float uSwayF; uniform float uSwayA;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float swayY = clamp(position.y, 0.0, 1.0);
        transformed.x += sin(uSwayT * uSwayF + modelMatrix[3].x * 0.7) * uSwayA * swayY * swayY;`,
      );
  };
  m.customProgramCacheKey = () => `sway${freq}_${amp}`;
  return m;
}
