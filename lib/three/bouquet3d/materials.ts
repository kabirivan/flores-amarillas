/**
 * Materiales del ramo real. Dos capas de shader inyectadas en los materiales estándar:
 *
 * 1. Materialización: un umbral de ruido 3D (de abajo arriba) descarta los fragmentos aún
 *    no revelados y deja un borde incandescente. Un uniform `uReveal` por pieza.
 * 2. Textura procedural según la pieza, sin imágenes:
 *    - pétalo: nervaduras finas a lo largo, variación de tono, brillo a contraluz en bordes;
 *    - hoja: nervio central claro y nervios laterales en espiga;
 *    - papel: fibra y arrugas que perturban la normal (la luz dibuja los pliegues);
 *    - pelusa (mimosa, paniculata): superficie vellosa, sin brillo, con borde que atrapa la luz.
 * 3. Lo que quita el aspecto de plástico: translucidez (los pétalos y hojas finos dejan pasar
 *    la luz que les llega por detrás), oclusión en la base de cada pétalo y en el interior del
 *    ramo, y una forma ligeramente distinta en cada pétalo instanciado.
 */

import * as THREE from 'three'
import { GROUND } from '../garden/layout'

export type RevealUniforms = { uReveal: { value: number }; uGlow: { value: THREE.Color } }

export function createRevealUniforms(): RevealUniforms {
  return { uReveal: { value: 1 }, uGlow: { value: new THREE.Color('#ffd98a') } }
}

/**
 * Regiones del atlas de la planta de girasol (girasol-planta.glb), en uv de la textura:
 * [u0, v0, ancho, alto]. La hoja incluye el peciolo arriba; el tallo es la franja derecha.
 */
export const ATLAS = { leaf: [0.0005, 0.002, 0.468, 0.717], stem: [0.78, 0, 0.2, 1] } as const

/** Número como literal float de GLSL. */
const glf = (n: number) => n.toFixed(4)

/** uv de la geometría → uv del atlas, igual que hacen los shaders (para muestrear colores). */
export function atlasUv(kind: 'leaf' | 'stem', u: number, v: number): [number, number] {
  const r = ATLAS[kind]
  return kind === 'leaf' ? [r[0] + u * r[2], r[1] + v * r[3]] : [r[0] + v * r[2], u]
}

/** Oclusión del ramo: centro y radio de la cúpula de flores (xyz, w), compartidos por todo. */
export type AoUniform = { value: THREE.Vector4 }
export const createAoUniform = (): AoUniform => ({ value: new THREE.Vector4(0, 0, 0, 0) })

type Detail = 'petal' | 'leaf' | 'photoLeaf' | 'paper' | 'fuzz' | 'stem' | 'none'
type Chunks = { color: string; normal: string; emissive: string; vertex?: string }

/**
 * Translucidez de lámina fina: la luz que llega por el lado que no vemos atraviesa el pétalo
 * y lo tiñe de su color. Usa las dos luces direccionales principales del motor (principal y
 * contraluz, ver engine.ts), en el mundo; la normal ya mira hacia la cámara (DoubleSide).
 */
const translucency = (amount: number) => `
  vec3 faNW = inverseTransformDirection(normal, viewMatrix);
  float faBack = max(0.0, dot(-faNW, normalize(vec3(3.0, 3.0, -6.0)))) * 1.6
    + max(0.0, dot(-faNW, normalize(vec3(-4.0, 6.0, 8.0)))) * 0.8;
  totalEmissiveRadiance += diffuseColor.rgb * diffuseColor.rgb * vec3(1.0, 0.85, 0.6) * faBack * ${amount.toFixed(2)};`

const NOISE = /* glsl */ `
float fa_hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fa_noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fa_hash(i + vec3(0,0,0)), fa_hash(i + vec3(1,0,0)), f.x),
                 mix(fa_hash(i + vec3(0,1,0)), fa_hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fa_hash(i + vec3(0,0,1)), fa_hash(i + vec3(1,0,1)), f.x),
                 mix(fa_hash(i + vec3(0,1,1)), fa_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`

const DETAIL: Record<Detail, Chunks> = {
  petal: {
    // Cada pétalo instanciado se curva y se retuerce un poco distinto: sin esto, todos los
    // pétalos de una corona son copias exactas y el ojo lo lee como plástico moldeado.
    vertex: `
      #ifdef USE_INSTANCING
      float faSeed = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float faSeed2 = fract(faSeed * 91.7);
      float faL = max(transformed.y, 0.0);
      transformed.z += (faSeed - 0.5) * 0.3 * faL * uv.y;
      transformed.z += (faSeed2 - 0.5) * 0.3 * (uv.x - 0.5) * faL;
      transformed.x += (faSeed2 - 0.5) * 0.12 * faL * uv.y * uv.y;
      #endif`,
    // Nervaduras irregulares, moteado, base en sombra (donde se juntan los pétalos) y punta
    // más clara y algo más cálida; el borde, un poco más fino y translúcido.
    color: `
      float faAcross = (vFaUv.x - 0.5) * (1.2 - vFaUv.y * 0.4);
      float faWobble = fa_noise(vec3(vFaUv * vec2(3.0, 9.0), vFaWorld.z * 3.0)) * 0.6;
      float faVein = pow(abs(sin((faAcross + faWobble * 0.05) * 3.14159 * 13.0)), 10.0) * smoothstep(0.02, 0.25, vFaUv.y);
      diffuseColor.rgb *= 1.0 - faVein * 0.12;
      diffuseColor.rgb *= 0.88 + 0.16 * fa_noise(vec3(vFaUv * vec2(5.0, 18.0), vFaWorld.x * 4.0));
      diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(0.0, 0.32, vFaUv.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.03, 0.92), smoothstep(0.55, 1.0, vFaUv.y));
      diffuseColor.rgb *= 1.0 - 0.1 * smoothstep(0.35, 0.5, abs(vFaUv.x - 0.5));`,
    // Microrelieve: la superficie de un pétalo no es lisa (células y surcos de las venas).
    normal: `normal = normalize(normal + vec3((fa_noise(vec3(vFaUv * vec2(40.0, 90.0), 2.0)) - 0.5) * 0.18, 0.0, 0.0));`,
    emissive: translucency(0.5),
  },
  leaf: {
    color: `
      float faRib = 1.0 - smoothstep(0.0, 0.035, abs(vFaUv.x - 0.5));
      float faSide = abs(vFaUv.x - 0.5);
      float faLat = pow(abs(sin((vFaUv.y * 9.0 - faSide * 5.0) * 3.14159)), 22.0) * (1.0 - faRib) * smoothstep(0.03, 0.12, faSide);
      diffuseColor.rgb *= 0.9 + 0.12 * fa_noise(vec3(vFaUv * 30.0, 1.0));
      // Cada hoja con su tono: unas más amarillentas, otras más azuladas.
      float faTone = fa_noise(floor(vFaWorld * 1.5) + 0.5);
      diffuseColor.rgb *= mix(vec3(0.92, 0.98, 1.04), vec3(1.08, 1.04, 0.86), faTone);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.45 + vec3(0.02, 0.05, 0.0), faRib * 0.8 + faLat * 0.35);`,
    normal: `normal = normalize(normal + vec3((vFaUv.x - 0.5) * 0.5, 0.0, 0.0));`,
    emissive: translucency(0.3),
  },
  paper: {
    // Papel de florista: fibras, motas y arrugas en dos escalas; las arrugas marcan líneas
    // más oscuras donde el papel se dobla.
    color: `
      float faFib = fa_noise(vFaWorld * vec3(160.0, 40.0, 160.0));
      float faCrease = 1.0 - abs(fa_noise(vFaWorld * 3.5) * 2.0 - 1.0);
      diffuseColor.rgb *= 0.9 + 0.08 * faFib + 0.05 * fa_noise(vFaWorld * 7.0);
      diffuseColor.rgb *= 1.0 - 0.06 * pow(faCrease, 6.0);
      diffuseColor.rgb *= 1.0 - 0.08 * step(0.985, fa_noise(vFaWorld * 220.0));`,
    // Arrugas: la normal se perturba con ruido en dos escalas; la luz marca los pliegues.
    normal: `
      vec3 faP = vFaWorld * 5.0;
      vec3 faQ = vFaWorld * 19.0;
      float faE = 0.02;
      vec3 faGrad = vec3(fa_noise(faP + vec3(faE, 0, 0)) - fa_noise(faP - vec3(faE, 0, 0)), fa_noise(faP + vec3(0, faE, 0)) - fa_noise(faP - vec3(0, faE, 0)), 0.0) / (2.0 * faE);
      vec3 faGrad2 = vec3(fa_noise(faQ + vec3(faE, 0, 0)) - fa_noise(faQ - vec3(faE, 0, 0)), fa_noise(faQ + vec3(0, faE, 0)) - fa_noise(faQ - vec3(0, faE, 0)), 0.0) / (2.0 * faE);
      normal = normalize(normal + faGrad * 0.14 + faGrad2 * 0.05);`,
    // Papel fino: a contraluz deja pasar algo de luz.
    emissive: translucency(0.15),
  },
  fuzz: {
    // Borla vellosa: miles de estambres. Tono irregular, sombra entre los pelos y un borde
    // que se ilumina (los pelos de la silueta atrapan la luz), sin brillo especular.
    color: `
      float faF = fa_noise(vFaWorld * 140.0);
      diffuseColor.rgb *= 0.72 + 0.4 * faF;`,
    normal: `
      vec3 faQ = vFaWorld * 160.0;
      normal = normalize(normal + (vec3(fa_noise(faQ), fa_noise(faQ + 7.1), fa_noise(faQ + 3.3)) - 0.5) * 1.1);`,
    emissive: `totalEmissiveRadiance += diffuseColor.rgb * 0.35 * pow(1.0 - abs(normal.z), 3.0);`,
  },
  photoLeaf: {
    // La hoja fotografiada del atlas de la planta de girasol (ver ATLAS).
    vertex: `
      #ifdef USE_MAP
      vMapUv = vec2(${glf(ATLAS.leaf[0])} + uv.x * ${glf(ATLAS.leaf[2])}, ${glf(ATLAS.leaf[1])} + uv.y * ${glf(ATLAS.leaf[3])});
      #endif`,
    color: `
      // En el atlas, la foto del girasol asoma en la esquina de la hoja: fuera.
      if (vFaUv.x > 0.55 && vFaUv.y > 0.84) discard;
      float faTone = fa_noise(floor(vFaWorld * 1.5) + 0.5);
      diffuseColor.rgb *= mix(vec3(0.9, 0.97, 1.02), vec3(1.06, 1.04, 0.88), faTone);`,
    normal: ``,
    emissive: translucency(0.3),
  },
  stem: {
    // La corteza del tallo del atlas, a lo largo del tubo (si hay atlas).
    vertex: `
      #ifdef USE_MAP
      vMapUv = vec2(${glf(ATLAS.stem[0])} + uv.y * ${glf(ATLAS.stem[2])}, uv.x);
      #endif`,
    // Más claro hacia la flor, con estrías a lo largo.
    color: `
      diffuseColor.rgb *= 0.78 + 0.3 * smoothstep(0.0, 1.0, vFaUv.x);
      diffuseColor.rgb *= 0.94 + 0.08 * sin(vFaUv.y * 6.2832 * 5.0);`,
    normal: ``,
    emissive: ``,
  },
  none: { color: ``, normal: ``, emissive: `` },
}

/** Inyecta materialización y textura en un material estándar de Three.js. */
function enhance<T extends THREE.MeshStandardMaterial>(material: T, reveal: RevealUniforms, ao: AoUniform, detail: Detail): T {
  const d = DETAIL[detail]
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = reveal.uReveal
    shader.uniforms.uGlow = reveal.uGlow
    shader.uniforms.uAo = ao
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFaWorld;\nvarying vec2 vFaUv;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${d.vertex ?? ''}`)
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 faWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          faWorld = instanceMatrix * faWorld;
        #endif
        vFaWorld = (modelMatrix * faWorld).xyz;
        vFaUv = uv;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vFaWorld;\nvarying vec2 vFaUv;\nuniform float uReveal;\nuniform vec3 uGlow;\nuniform vec4 uAo;\n${NOISE}`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        // Aparece de abajo arriba (desde el papel hacia las flores) con un borde de ruido.
        float faH = clamp((vFaWorld.y - ${GROUND.toFixed(2)}) / 3.9, 0.0, 1.0);
        float faN = fa_noise(vFaWorld * 6.0) * 0.35 + faH * 0.65;
        float faEdge = uReveal * 1.1 - 0.05;
        if (faN > faEdge) discard;
        float faRim = smoothstep(faEdge - 0.06, faEdge, faN) * step(uReveal, 0.999);`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${d.color}
        // Oclusión: el interior del ramo (tallos, bases, hojas de dentro) queda en sombra;
        // las cabezas, en la superficie de la cúpula, reciben toda la luz.
        if (uAo.w > 0.0) {
          float faD = length(vFaWorld - uAo.xyz) / uAo.w;
          diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(0.3, 0.95, faD));
        }`,
      )
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${d.normal}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * faRim * 3.0;\n${d.emissive}`)
  }
  material.customProgramCacheKey = () => `fa-${detail}-${material.type}`
  return material
}

export type Materials = ReturnType<typeof createMaterials>

export function createMaterials(reveal: RevealUniforms, ao: AoUniform, atlas: THREE.Texture | null = null) {
  const std = (opts: THREE.MeshStandardMaterialParameters, detail: Detail = 'none') =>
    enhance(new THREE.MeshStandardMaterial(opts), reveal, ao, detail)
  const phys = (opts: THREE.MeshPhysicalMaterialParameters, detail: Detail = 'none') =>
    enhance(new THREE.MeshPhysicalMaterial(opts), reveal, ao, detail)

  return {
    /**
     * Pétalos: mate y aterciopelados (sheen suave, casi sin reflejo especular), con
     * translucidez a contraluz. El brillo especular es lo que más los hacía parecer plástico.
     */
    petal: phys(
      {
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.78,
        specularIntensity: 0.25,
        sheen: 0.7,
        sheenRoughness: 0.85,
        sheenColor: new THREE.Color('#fff1c4'),
        envMapIntensity: 0.6,
      },
      'petal',
    ),
    /** Hojas y sépalos: nervios, cutícula apenas cerosa, translúcidas a contraluz. */
    leaf: phys({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.62, specularIntensity: 0.4, clearcoat: 0.08, clearcoatRoughness: 0.7 }, 'leaf'),
    stem: atlas ? std({ map: atlas, color: '#d8e8c8', roughness: 0.7 }, 'stem') : std({ color: '#3e7c5a', roughness: 0.7 }, 'stem'),
    /** Hoja real (foto del atlas), recortada por su transparencia. Null sin atlas. */
    photoLeaf: atlas ? std({ map: atlas, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.68 }, 'photoLeaf') : null,
    /** Capítulo del girasol y botones. */
    disc: std({ color: '#5c2a0c', roughness: 0.95 }, 'fuzz'),
    seedDot: std({ color: '#a8561a', roughness: 0.65, emissive: new THREE.Color('#6b3410'), emissiveIntensity: 0.2 }),
    /** Botón de la margarita: cientos de florecillas diminutas, velloso y sin brillo. */
    daisyCore: phys({ color: '#ffb627', roughness: 1, specularIntensity: 0.1, sheen: 0.6, sheenRoughness: 0.9, sheenColor: new THREE.Color('#ffe08a') }, 'fuzz'),
    /** Mimosa: borlas vellosas (sheen de terciopelo, nada de reflejo). */
    pompon: phys({ color: '#ffd23f', roughness: 1, specularIntensity: 0, sheen: 1, sheenRoughness: 0.9, sheenColor: new THREE.Color('#fff0a0') }, 'fuzz'),
    /** Paniculata en crema dorado: nada de blanco puro; vellosa como la mimosa. */
    filler: phys({ color: '#efd9a0', roughness: 1, specularIntensity: 0, sheen: 0.8, sheenRoughness: 0.9, sheenColor: new THREE.Color('#fff8e0') }, 'fuzz'),
    paper: std({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92 }, 'paper'),
    tissue: std({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }, 'paper'),
    ribbon: phys({ color: '#c96b6b', roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#ffd0c0') }),
    dispose() {
      for (const m of Object.values(this)) if (m instanceof THREE.Material) m.dispose()
    },
  }
}

/**
 * Cabeza de flor de un modelo real (textura fotográfica). Mate, con la misma materialización
 * y oclusión que el resto; la textura ya trae su sombreado, así que el relieve lo da la luz.
 */
export function createHeadMaterial(map: THREE.Texture | null, reveal: RevealUniforms, ao: AoUniform, tint = '#ffffff'): THREE.MeshStandardMaterial {
  const m = enhance(new THREE.MeshStandardMaterial({ map, color: new THREE.Color(tint), side: THREE.DoubleSide, roughness: 0.9, metalness: 0 }), reveal, ao, 'none')
  m.userData.kind = 'head'
  return m
}

/** Marca los pétalos (el muestreo de partículas les da más peso: son lo que tiene que leerse). */
export function tagMaterials(m: Materials): Materials {
  m.petal.userData.kind = 'petal'
  m.stem.userData.kind = 'stem'
  if (m.stem.map) m.stem.userData.atlas = 'stem'
  if (m.photoLeaf) m.photoLeaf.userData.atlas = 'leaf'
  return m
}
