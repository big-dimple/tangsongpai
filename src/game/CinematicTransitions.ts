import type Phaser from 'phaser';

/**
 * Pure WebGL2 GLSL ES 3.00 physical transitions adapted from cinematic-webgl-craft
 * (tear, flaps, wash, slam) with zero external 3D runtime dependencies.
 * Presentation only: overlays a non-blocking canvas and never delays scene cuts.
 */
export type PhysicalShaderKind = 'tear' | 'flaps' | 'wash' | 'slam';

export const PHYSICAL_TRANSITION_DURATIONS_MS: Record<PhysicalShaderKind, number> = {
  tear: 720,
  flaps: 620,
  wash: 760,
  slam: 680,
};

export function physicalTransitionDurationMs(kind: PhysicalShaderKind, speed: 1 | 2 | 4 = 1): number {
  const rate = speed === 2 || speed === 4 ? speed : 1;
  return Math.max(180, Math.round(PHYSICAL_TRANSITION_DURATIONS_MS[kind] / rate));
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const invLerp = (a: number, b: number, v: number): number => clamp01((v - a) / (b - a));
const smoothstep01 = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Solve column-major 3x3 inverse projective homography mapping 4 clip corners to unit UV [0,1]^2. */
export function solveHomography(corners: readonly (readonly [number, number])[]): Float32Array | null {
  const [tl, tr, br, bl] = corners;
  const ax = bl[0], ay = bl[1];
  const lx = br[0], cy = br[1];
  const ux = tr[0], fy = tr[1];
  const hx = tl[0], dy = tl[1];
  const px = lx - ux, xx = hx - ux, vx = ax - lx + ux - hx;
  const my = cy - fy, gy = dy - fy, by = ay - cy + fy - dy;
  const denom = px * gy - xx * my;
  if (!(Math.abs(denom) > 1e-12)) return null;
  const sx = (vx * gy - xx * by) / denom;
  const sy = (px * by - vx * my) / denom;
  // Column-major matrix M before inversion:
  const n11 = lx - ax + sx * lx, n12 = hx - ax + sy * hx, n13 = ax;
  const n21 = cy - ay + sx * cy, n22 = dy - ay + sy * dy, n23 = ay;
  const n31 = sx, n32 = sy, n33 = 1;
  const t11 = n33 * n22 - n32 * n23;
  const t12 = n32 * n13 - n33 * n12;
  const t13 = n23 * n12 - n22 * n13;
  const det = n11 * t11 + n21 * t12 + n31 * t13;
  if (Math.abs(det) < 1e-14) return null;
  const inv = 1 / det;
  const m = new Float32Array([
    t11 * inv,
    (n31 * n23 - n33 * n21) * inv,
    (n32 * n21 - n31 * n22) * inv,
    t12 * inv,
    (n33 * n11 - n31 * n13) * inv,
    (n31 * n12 - n32 * n11) * inv,
    t13 * inv,
    (n21 * n13 - n23 * n11) * inv,
    (n22 * n11 - n21 * n12) * inv,
  ]);
  const cxAvg = (ax + lx + ux + hx) / 4;
  const cyAvg = (ay + cy + fy + dy) / 4;
  if (m[2] * cxAvg + m[5] * cyAvg + m[8] < 0) {
    for (let i = 0; i < 9; i++) m[i] *= -1;
  }
  return m;
}

export const GLSL_HASH = `
float hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float hash13(vec3 p3){p3=fract(p3*.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}
vec2 hash21(float p){vec3 p3=fract(vec3(p)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
`;

export const GLSL_NOISE =
  GLSL_HASH +
  `
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y);}
float vnoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
 return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec2 p){float a=.5,s=0.;mat2 m=mat2(.8,.6,-.6,.8);for(int i=0;i<4;i++){s+=a*vnoise(p);p=m*p*2.03;a*=.5;}return s;}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*vnoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
`;

export const GLSL_COLOR = `
vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
vec3 toSrgb(vec3 c){c=max(c,0.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
`;

const FULLSCREEN_VERT = `#version 300 es
precision highp float;
in vec2 position;
out vec2 vUv;
void main(){
  vUv = position;
  gl_Position = vec4(position * 2. - 1., .999, 1.);
}`;

const TEAR_DUR = 2.8;
const TEAR_SEG_X = 32;
const TEAR_SEG_Y = 64;
const TEAR_SCRAPS = 46;

const GLSL_TEAR_COMMON = `
uniform float uAsp, uP, uYf, uW2;
const float CAM = 3.0;
float slow(float y){
  return .075 * sin(y * 2.1 + .8) + .034 * sin(y * 5.3 + 2.) + .012 * sin(y * 13. + .5);
}
float openAt(float y){ return max(0., y - uYf); }
vec3 curl(vec2 P, float sg, out float phi, out float over){
  float h = openAt(P.y);
  float d = (P.x - slow(P.y)) * sg;
  float R = .21 + .10 * smoothstep(0., 1.6, uW2) + .03 * P.y;
  float w = .36 * pow(h, 1.5) + uW2 * smoothstep(0., .3, h) * (1. + sg * .045 + .10 * P.y);
  float s = w - d;
  float pull = sg * (.010 * smoothstep(0., .10, h) + .050 * h + .02 * h * h);
  float x = P.x, z = 0.;
  phi = 0.;
  over = exp(-max(d - w, 0.) / (R * .9)) * smoothstep(.15, 1.5, w / R);
  if (s > 0.) {
    phi = s / R;
    float xc = slow(P.y) + sg * w;
    if (phi < 3.14159) {
      x = xc - sg * R * sin(phi);
      z = R * (1. - cos(phi));
    } else {
      x = xc + sg * (s - 3.14159 * R);
      z = 2. * R + .06 * (s - 3.14159 * R);
      phi = 3.14159;
    }
  }
  z += .02 * sin(P.y * 4. + uP * 17. + sg) * smoothstep(0., 1., max(s, 0.)) * 1.5;
  return vec3(x + pull, P.y - .02 * max(s, 0.) * smoothstep(.2, 1., h), z);
}
vec4 proj(vec3 w){
  float k = (CAM - w.z) / CAM;
  return vec4(w.x / uAsp, w.y, 0., k);
}
`;

const GLSL_TEAR_FIBRES = `
float tearFine(float y){
  return .022 * (fbm(vec2(y * 9., 3.)) - .5) * 2.
       + .007 * (vnoise(vec2(y * 60., 7.)) - .5)
       + .003 * (vnoise(vec2(y * 190., 2.)) - .5);
}
float fibres(float e, float y, float px, float seed){
  float a = 0.;
  for (int L = 0; L < 2; L++) {
    float n = L == 0 ? 70. : 160.;
    float c = floor(y * n);
    for (int j = -1; j <= 1; j++) {
      float id = c + float(j);
      vec2 h = hash22(vec2(id, seed + float(L) * 7.));
      vec2 h2 = hash22(vec2(id + 31., seed + float(L) * 3.));
      float len = (L == 0 ? .030 : .014) * h.y * h.y * (.4 + .6 * h2.y);
      float y0 = (id + h.x) / n;
      float k = clamp(-e / max(len, 1e-4), 0., 1.);
      float yy = y0 + (h2.x - .5) * len * 1.3 * k + (h2.y - .5) * len * 1.6 * k * k;
      float wd = (L == 0 ? .0012 : .0008) * (1. - .75 * k);
      float dd = abs(y - yy) - wd;
      float end = len + e;
      a = max(a, smoothstep(px * .7, -px * .5, dd) * smoothstep(0., .0025, end) * (L == 0 ? .95 : .8));
    }
  }
  return a;
}
`;

const TEAR_SHEET_VERT = `#version 300 es
precision highp float;
in vec3 position;
out vec2 vP;
out float vPhi, vOver;
flat out float vSg;
${GLSL_TEAR_COMMON}
void main(){
  float sg = position.z;
  float y = mix(-1., 1., position.y);
  float outer = sg * uAsp, inner = slow(y) - sg * .085;
  float x = mix(outer, inner, position.x);
  vP = vec2(x, y);
  vSg = sg;
  vec3 w = curl(vP, sg, vPhi, vOver);
  gl_Position = proj(w);
}`;

const TEAR_SHEET_FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 vP;
in float vPhi, vOver;
flat in float vSg;
out vec4 o;
uniform sampler2D tA, tB;
uniform vec2 uRes;
${GLSL_COLOR}
${GLSL_NOISE}
${GLSL_TEAR_COMMON}
${GLSL_TEAR_FIBRES}
void main(){
  float y = vP.y, h = openAt(y);
  float op = h > 0. ? smoothstep(.002, .05, h + .006 * (vnoise(vec2(y * 40., 1.)) - .5)) : 0.;
  float e0 = (vP.x - slow(y)) * vSg;
  bool nr = e0 < .15;
  vec2 uv = vec2(vP.x / uAsp, y) * .5 + .5;
  bool front = gl_FrontFacing;
  float e = nr ? (vP.x - slow(y) - tearFine(y)) * vSg : e0;
  float px = max(fwidth(e0), 1e-5);
  float al = 1.;
  if (e < .16) {
    float f = e < .004 ? fibres(e, y, max(px, fwidth(y)), vSg * 5.) : 0.;
    float body = smoothstep(-px * .7, px * .7, e + mix(.02, 0., smoothstep(0., .012, h)));
    al = max(body, f * op);
  }
  if (al <= .003) discard;
  vec3 n = vec3(vSg * sin(vPhi), 0., cos(vPhi));
  const vec3 L = normalize(vec3(-.38, .42, .82));
  float core = 0.;
  if (nr && op > 0.) {
    float share = smoothstep(.38, .62, fbm(vec2(y * 5.5, 11.)));
    float wide = .006 + .050 * (vSg < 0. ? share : 1. - share) * (.55 + .9 * fbm(vec2(y * 14., vSg * 5.)));
    float jag = .010 * (fbm(vec2(y * 38., vSg * 9.)) - .5) + .004 * (vnoise(vec2(y * 170., vSg)) - .5);
    core = (wide + jag) * op;
    if (!front) core *= .42;
  }
  vec3 ink;
  if (front) {
    ink = toLin(clamp(texture(tA, uv).rgb, 0., 1.));
  } else {
    float fb = fbm(vP * vec2(70., 55.));
    ink = vec3(.062, .042, .052) * (.75 + .5 * fb) + vec3(.012, .009, .006) * smoothstep(.62, .8, vnoise(vP * vec2(160., 40.)));
  }
  float edge = core > 0. ? smoothstep(-px, px, e - core) : 1.;
  vec3 c = ink;
  float tone = 1.;
  if (e < core + .02 && op > 0.) {
    float q = clamp(e / max(core, .001), 0., 1.);
    float l1 = .34 + .22 * (fbm(vec2(y * 24., 3. + vSg)) - .5) * 2.;
    float l2 = .68 + .2 * (fbm(vec2(y * 33., 8. + vSg)) - .5) * 2.;
    vec2 fq = vec2(e * 70. + y * 9. * (vnoise(vec2(y * 13., 1.)) - .5), y * 300.);
    float str = vnoise(fq) * .5 + vnoise(fq * vec2(2.1, 1.9) + 7.) * .5;
    float fine = vnoise(vec2(e * 900., y * 700.));
    vec3 w = vec3(.93, .90, .85) * (.80 + .16 * str + .08 * fine);
    float st1 = smoothstep(.10, 0., abs(q - l1));
    float st2 = smoothstep(.10, 0., abs(q - l2));
    w *= 1. - .16 * st1 * step(q, l1) - .20 * st2 * step(q, l2) + .06 * st1 * step(l1, q);
    w *= mix(.90, 1., smoothstep(0., .5, q));
    vec3 bl = toLin(clamp(texture(tB, gl_FragCoord.xy / uRes).rgb, 0., 1.));
    float thin = (1. - smoothstep(0., .75, q)) * .55;
    w = mix(w, w * (.35 + .75 * bl) + bl * .10, thin);
    w *= 1. - .30 * exp(-max(core - e, 0.) / .0045);
    c = mix(w, ink, edge);
    c += edge * exp(-max(e - core, 0.) / .0016) * vec3(.16) * op * (front ? 1. : .5);
    tone = mix(1., 0., edge);
  }
  vec3 N = front ? n : -n;
  float dl = max(dot(N, L), 0.);
  float eL = front ? mix(1., (.34 + .66 * dl / L.z), smoothstep(0., .25, vPhi)) : (.18 + 1.25 * dl * dl);
  c *= eL;
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float gls = pow(max(dot(N, H), 0.), front ? 26. : 14.) * smoothstep(0., .35, vPhi);
  if (!front) {
    float rim = pow(1. - abs(N.z), 3.);
    c += vec3(.85, .68, .42) * .05 * rim;
  }
  c += vec3(1., .95, .85) * gls * (front ? .06 : .05) * (1. - tone * .8);
  c *= 1. - .72 * vOver * (1. - smoothstep(0., .9, vPhi));
  o = vec4(c * al, al);
}`;

const TEAR_SCRAP_VERT = `#version 300 es
precision highp float;
precision highp int;
in vec2 position;
out vec2 vQ;
flat out vec4 vS;
out float vK;
${GLSL_NOISE}
${GLSL_TEAR_COMMON}
uniform float uT;
void main(){
  float i = float(gl_InstanceID);
  vec2 h = hash21(i * 1.7 + 2.), h2 = hash21(i * 3.1 + 9.), h3 = hash21(i * 5.7 + 4.);
  float y0 = mix(-.98, 1.02, (i + h.x) / ${TEAR_SCRAPS}.);
  float k = clamp((1.08 - y0) / 2.4, 0., 1.);
  float t0 = (.02 + .54 * k) * ${TEAR_DUR} + h.y * .12;
  float t = uT - t0;
  if (t <= 0.) { gl_Position = vec4(2.); return; }
  float sz = mix(.007, .034, h2.x * h2.x);
  float drag = 1. - exp(-t * 1.6);
  vec3 c = vec3(
    slow(y0) + (h2.y - .5) * 1.1 * drag + .05 * sin(t * (5. + 6. * h3.x) + i) * min(t, 1.),
    y0 + (.25 * h3.x + .05) * drag - (.55 + .5 * h3.y) * t * t - .35 * t * sz * 8.,
    .05 + .5 * h3.x * drag
  );
  float a1 = t * (4. + 9. * h3.y) * (h.x > .5 ? 1. : -1.) + i;
  float a2 = t * (5. + 8. * h.y) + i * 2.;
  vec2 q = position * sz * vec2(1., .75);
  float ca = cos(a1), sa = sin(a1);
  vec3 P = vec3(q.x * ca - q.y * sa, q.x * sa + q.y * ca, 0.);
  float cb = cos(a2), sb = sin(a2);
  P = vec3(P.x, P.y * cb, P.y * sb);
  gl_Position = proj(c + P);
  vQ = position;
  vS = vec4(h, h2);
  vK = sb;
}`;

const TEAR_SCRAP_FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vQ;
flat in vec4 vS;
in float vK;
out vec4 o;
${GLSL_NOISE}
void main(){
  float a = atan(vQ.y, vQ.x), r = length(vQ);
  float sd = 3. + floor(vS.z * 2.99), aa = a + vS.w * 6.28;
  float R = .50 / cos(mod(aa, 6.2832 / sd) - 3.14159 / sd)
          + .26 * (vnoise(vec2(cos(a), sin(a)) * 1.7 + vS.xy * 40.) - .5)
          + .14 * (vnoise(vec2(cos(a), sin(a)) * 9. + vS.zw * 30.) - .5);
  float px = fwidth(r);
  float al = smoothstep(R + px, R - px, r);
  if (al < .01) discard;
  float ink = smoothstep(0., px * 1.5, R - .07 - .26 * vnoise(vQ * 2. + vS.xy * 9.) * step(.0, vQ.x) - r);
  vec3 w = vec3(.91, .87, .82) * (.82 + .2 * vnoise(vQ * 9.));
  vec3 c = mix(w, gl_FrontFacing ? vec3(.062, .042, .052) : w * .96, ink);
  c *= .62 + .38 * abs(vK) + .25 * max(vK, 0.);
  o = vec4(c * al, al);
}`;

const MASK_BLUR_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
uniform sampler2D tA;
uniform vec2 uD;
uniform float uCh;
void main(){
  float s = 0., w = 0.;
  for (int i = -5; i <= 5; i++) {
    float k = exp(-float(i * i) / 14.);
    vec4 t = texture(tA, vUv + uD * float(i));
    s += k * (uCh > .5 ? t.a : t.r);
    w += k;
  }
  o = vec4(s / w, 0., 0., 1.);
}`;

const TEAR_COMP_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
${GLSL_COLOR}
uniform sampler2D tB, tL, tN, tF;
uniform float uAsp, uS;
void main(){
  vec4 b = texture(tB, vUv), l = texture(tL, vUv);
  float n = texture(tN, vUv + vec2(.006 / uAsp, .010)).r;
  float f = texture(tF, vUv + vec2(.020 / uAsp, .045)).r;
  float s = 1. - (1. - .62 * n * uS) * (1. - .55 * f * uS);
  if (l.a <= 0. && s < .0008) { o = b; return; }
  vec3 c = toLin(clamp(b.rgb, 0., 1.)) * mix(vec3(1.), vec3(.14, .11, .16), s);
  c = c * (1. - l.a) + l.rgb;
  o = vec4(toSrgb(c), 1.);
}`;

const FLAPS_DUR = 2.6;
const FLAP_ROWS = 10;

const GLSL_FLAP_TIMING =
  GLSL_HASH +
  `
uniform vec2 uGrid;
uniform float uT;
float tileStart(vec2 id){
  vec2 c = (id + .5) / uGrid;
  float d = (c.x * 1.1 + (1. - c.y) * .9) / 2.;
  float h = hash12(id + 3.7);
  return .17 + d * 1.30 + h * .16 + .05 * sin(c.x * 9. + c.y * 5.);
}
int tileN(vec2 id){ return hash12(id + 17.3) > .62 ? 3 : 2; }
float flipDur(int k, int n){ return k == n - 1 ? .34 : (k == 0 ? .22 : .19); }
vec3 tileState(vec2 id){
  float t = uT - tileStart(id);
  int n = tileN(id);
  if (t <= 0.) return vec3(-1., 0., t);
  for (int k = 0; k < 3; k++) {
    if (k >= n) break;
    float d = flipDur(k, n);
    if (t < d) {
      float x = t / d, a;
      if (k == n - 1) {
        x = t / (d * .62);
        if (x < 1.) a = x * x * (1.35 - .35 * x);
        else {
          float y = (t - d * .62) / (d * .38);
          a = 1. - .085 * sin(y * 3.14159) * (1. - y);
        }
      } else {
        a = pow(x, 1.75);
      }
      return vec3(float(k), a * 3.14159265, 0.);
    }
    t -= d;
  }
  return vec3(float(n), 0., t);
}`;

const GLSL_FLAP_FACES =
  GLSL_COLOR +
  `
uniform sampler2D tA, tB;
vec3 slide(vec2 f, vec2 id){
  float h = hash12(id + 8.1);
  vec3 c = vec3(.075, .052, .082);
  vec2 d = abs(f - .5);
  float border = step(.42, max(d.x, d.y)) - step(.45, max(d.x, d.y));
  float diamond = step(abs(d.x + d.y - .22), .028);
  vec3 gold = vec3(.72, .54, .26);
  c = mix(c, gold, clamp(border + diamond * .85, 0., 1.) * (.75 + .25 * h));
  return c;
}
vec3 face(int k, vec2 f, vec2 id){
  int n = tileN(id);
  vec2 uv = (id + f) / uGrid;
  if (k <= 0) return toLin(clamp(textureLod(tA, uv, 0.).rgb, 0., 1.));
  if (k >= n) return toLin(clamp(textureLod(tB, uv, 0.).rgb, 0., 1.));
  if (k == 1) return slide(f, id);
  vec2 sh = floor(hash22(id + float(k)) * vec2(uGrid));
  vec2 j = mod(id + sh, uGrid);
  return toLin(clamp(textureLod(tA, (j + f) / uGrid, 0.).rgb, 0., 1.));
}`;

const FLAP_BG_FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
uniform vec2 uRes;
${GLSL_FLAP_TIMING}
${GLSL_FLAP_FACES}
void main(){
  vec2 g = vUv * uGrid;
  vec2 id = min(floor(g), uGrid - 1.);
  vec2 f = g - id;
  vec3 st = tileState(id);
  int n = tileN(id);
  float gap = st.x < -.5 ? smoothstep(-.10, 0., st.z)
            : st.x > float(n) - .5 ? 1. - smoothstep(.0, .15, st.z)
            : 1.;
  vec2 tp = uRes / uGrid;
  if (st.x < -.5 && gap <= 0.) { o = texture(tA, vUv); return; }
  if (st.x > float(n) - .5 && gap <= 0.) { o = texture(tB, vUv); return; }
  vec2 e = min(f, 1. - f) * tp;
  float line = smoothstep(.1, 1.1, min(e.x, e.y) - .25);
  float mid = smoothstep(.2, .9, abs(f.y - .5) * tp.y);
  vec3 c;
  float sh = 1.;
  if (st.x < -.5) c = face(0, f, id);
  else if (st.x > float(n) - .5) c = face(n, f, id);
  else {
    int k = int(st.x + .5);
    float th = st.y, s = sin(th), q = cos(th);
    bool top = f.y > .5;
    float d = abs(f.y - .5) * 2.;
    if (top) {
      c = face(k + 1, f, id);
      float open = smoothstep(.0, 1.35, th);
      sh = mix(.22, 1., open) * (1. - .35 * (1. - smoothstep(1.4, 3.1, th)) * exp(-d * 3.));
    } else {
      c = face(k, f, id);
      float len = s * .95 + max(-q, 0.) * 1.05;
      float soft = .10 + .22 * s;
      float shade = 1. - smoothstep(len - soft, len + soft * .6, d);
      sh = 1. - .62 * shade * smoothstep(.05, .8, th);
    }
  }
  c *= sh;
  c *= mix(1., mix(.10, 1., line), gap);
  c *= mix(1., mix(.55, 1., mid), gap);
  o = vec4(toSrgb(c), 1.);
}`;

const FLAP_TILE_VERT = `#version 300 es
precision highp float;
precision highp int;
in vec2 position;
out vec2 vF;
flat out vec2 vId;
flat out vec3 vSt;
uniform float uAsp;
${GLSL_FLAP_TIMING}
void main(){
  int c = int(uGrid.x);
  vec2 id = vec2(float(gl_InstanceID % c), float(gl_InstanceID / c));
  vec3 st = tileState(id);
  vId = id;
  vSt = st;
  if (st.x < -.5 || st.x > float(tileN(id)) - .5) {
    gl_Position = vec4(2., 2., 2., 1.);
    return;
  }
  vF = vec2(position.x, .5 + position.y * .5);
  vec2 ctr = ((id + vec2(position.x, .5)) / uGrid * 2. - 1.) * vec2(uAsp, 1.);
  float hh = 1. / uGrid.y;
  float y = position.y * hh;
  float th = st.y;
  vec3 w = vec3(ctr.x, ctr.y + y * cos(th), y * sin(th));
  const float D = 2.1;
  float k = (D - w.z) / D;
  gl_Position = vec4(w.x / uAsp, w.y, (.5 - w.z) * k * .5, k);
}`;

const FLAP_TILE_FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 vF;
flat in vec2 vId;
flat in vec3 vSt;
out vec4 o;
uniform vec2 uRes;
${GLSL_FLAP_TIMING}
${GLSL_FLAP_FACES}
void main(){
  float th = vSt.y;
  int k = int(vSt.x + .5);
  float s = sin(th), c = cos(th);
  vec3 col;
  float e;
  float d = (vF.y - .5) * 2.;
  vec2 tp = uRes / uGrid;
  float gx = min(vF.x, 1. - vF.x) * tp.x;
  if (gx < .9) discard;
  bool front = gl_FrontFacing;
  if (front) {
    col = face(k, vF, vId);
    float l = .8 * c - .6 * s;
    e = .30 + .70 * max(l, 0.) / .8;
    e *= 1. - .18 * s * (1. - d);
  } else {
    col = face(k + 1, vec2(vF.x, 1. - vF.y), vId);
    float l = .6 * s - .8 * c;
    e = .30 + .70 * max(l, 0.) / .8;
    float sp = smoothstep(.12, .0, abs(th - 2.25));
    e = mix(1., e, s);
    col += vec3(.06, .045, .02) * sp * s;
  }
  float tip = smoothstep(2.2, .6, (1. - d) * tp.y * .5);
  col = mix(col, col * .55 + vec3(.14, .10, .12), tip * s * .8);
  o = vec4(toSrgb(min(col * e, vec3(1.))), 1.);
}`;

const GLSL_WATER_GLASS = `
float ss(float a, float b, float x){ return smoothstep(a, b, x); }
float rivulets(vec2 q, float d, float p){
  float h = 0.;
  for (int L = 0; L < 2; L++) {
    float n = L == 0 ? 7. : 13.;
    float x = q.x * n + float(L) * 3.7;
    float id0 = floor(x);
    for (int j = -1; j <= 1; j++) {
      float id = id0 + float(j);
      vec2 r = hash22(vec2(id, 17. + float(L)));
      if (r.x < .22) continue;
      float life = ss(0., .12, d) * (1. - ss(.62 + .2 * r.y, .80 + .17 * r.y, p));
      float me = .20 * sin(q.y * (5. + 5. * r.x) + id * 1.7) + .09 * sin(q.y * 17. + id) + .3 * (vnoise(vec2(q.y * 3., id)) - .5);
      float cx = id + .5 + me + (r.y - .5) * .4;
      float wd = (L == 0 ? .115 : .085) * (.6 + .6 * r.y) * (.7 + .5 * vnoise(vec2(q.y * 6. + p * 9., id * 3.))) * mix(1., .45, ss(.5, .9, p));
      float e = (x - cx) / wd;
      float bead = .65 + .55 * ss(.35, .8, vnoise(vec2(q.y * 9. + p * (10. + 8. * r.x), id * 5.)));
      h = max(h, life * bead * sqrt(max(0., 1. - e * e)) * wd * (L == 0 ? 1. : .8));
    }
  }
  return h * 1.2;
}
float beads(vec2 q, float n, float seed, float d, float big, float p){
  vec2 x = q * n;
  x.x += .5 * mod(floor(x.y), 2.);
  vec2 id = floor(x), f = fract(x) - .5;
  vec2 r = hash22(id + seed), r2 = hash22(id + seed + 9.);
  if (r.x < big) return 0.;
  float dry = .60 + .36 * r.y;
  float rad = (.13 + .30 * r2.y * r2.y) * (1. - ss(dry - .20, dry, p));
  rad *= ss(.00, .10, d - .05 * r2.x);
  vec2 c = (r2 - .5) * .34;
  vec2 e = f - c;
  e.x *= 1. + .25 * (r.x - .5);
  e.y *= mix(1., .82, r2.x);
  float wob = 1. + .14 * (vnoise(normalize(e + 1e-4) * 1.3 + id * 7.) - .5);
  float h = rad * rad * wob - dot(e, e);
  return h > 0. ? sqrt(h) / n * 1.5 : 0.;
}
float sliders(vec2 q, float n, float seed, float p){
  float x = q.x * n;
  float id = floor(x);
  float h = 0.;
  for (int j = -1; j <= 1; j++) {
    float c = id + float(j);
    vec2 r = hash22(vec2(c, seed)), r2 = hash22(vec2(c, seed + 5.));
    float t0 = .42 + .18 * r.y;
    float t = (p - t0) * 2.6;
    if (t < 0. || r.x < .25) continue;
    float go = t * (.42 + .4 * r2.y) + .05 * sin(t * 9. + c) + .035 * sin(t * 21. + c * 2.);
    float y = 1.12 - .35 * r2.x - go * 1.15;
    float sx = c + .5 + (r2.x - .5) * .5 + .12 * sin(y * 9. + c) + .06 * sin(y * 23.);
    vec2 e = vec2((x - sx) / n, q.y - y);
    float rad = (.010 + .014 * r2.y) * (1. - ss(.80, .97, p));
    e.y *= e.y > 0. ? .62 : 1.;
    float a = rad * rad - dot(e, e);
    h = max(h, a > 0. ? sqrt(a) : 0.);
    float tx = c + .5 + (r2.x - .5) * .5 + .12 * sin(q.y * 9. + c) + .06 * sin(q.y * 23.);
    float above = q.y - y;
    if (above > 0. && above < .55) {
      float cell = q.y * 64.;
      vec2 b = hash22(vec2(floor(cell), c + seed));
      float rr = .0048 * b.x * b.x * (1. - above / .55) * (1. - ss(.7, .92, p));
      vec2 g = vec2((x - tx) / n + (b.y - .5) * .006, (fract(cell) - .5) / 64.);
      float z = rr * rr * 1.6 - dot(g, g);
      h = max(h, z > 0. ? sqrt(z) : 0.);
      h = max(h, .0016 * ss(rad * .62, 0., abs(x - tx) / n) * ss(.28, 0., above));
    }
  }
  return h * 1.35;
}`;

const WASH_HEIGHT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform float p, uAsp;
${GLSL_NOISE}
${GLSL_WATER_GLASS}
float lip(vec2 q){
  float k = clamp(p / .36, 0., 1.);
  k = k * (.55 + .45 * k);
  vec2 dir = normalize(vec2(.34, 1.));
  float s = dot(q, dir);
  float F = mix(-.30, 2.05 + .30 * (uAsp - 1.78), k);
  return F - s + .10 * (fbm(q * 2.3 + vec2(p * 2., 0.)) - .5) * 2. + .030 * sin(q.x * 9. + p * 20.) + .018 * (vnoise(q * 13.) - .5);
}
float drain(vec2 q){
  float k = clamp((p - .40) / .46, 0., 1.);
  k = k * k * (3. - 2. * k);
  float L = mix(1.32, -.55, k);
  float col = .30 * (fbm(vec2(q.x * 2.1, 3.)) - .5) * 2.
            + .17 * (vnoise(vec2(q.x * 9. + .35 * sin(q.y * 5.), 9.)) - .5) * 2. * ss(.40, .6, p)
            + .05 * (vnoise(vec2(q.x * 26. + .3 * sin(q.y * 9.), 4.)) - .5);
  return q.y - L - col;
}
float sheet(vec2 q, float a, float d){
  float c = ss(-.005, .16, a) * ss(.02, -.14, d);
  vec2 fl = vec2(p * 1.6, p > .4 ? (p - .4) * 3.2 : -p * 2.2);
  vec2 w = vec2(fbm(q * 2. + fl), fbm(q * 2. + fl + 5.2));
  float wv = fbm(q * vec2(3.2, 2.2) + w * 1.4 + fl * 1.3) + .35 * vnoise(q * vec2(17., 8.) + w * 4. + fl * 4.);
  float st = vnoise(vec2(q.x * 30. + 3. * w.x, q.y * 2.5 + fl.y * 2.));
  float lipB = ss(0., .05, a) * ss(.22, .05, a) * .55 + ss(.02, -.02, d) * ss(-.10, -.02, d) * .28;
  return c * (.35 + .85 * wv + .18 * st * ss(.38, .55, p)) + lipB * c;
}
void main(){
  vec2 q = vUv * vec2(uAsp, 1.);
  float a = lip(q);
  float d = p > .36 ? drain(q) : -1.;
  float s = 0., w = 0.;
  if (a > -.02 && d < .05) s = sheet(q, a, d) * .085;
  if (p > .40 && d > -.05) {
    w = rivulets(q, d, p) * .11;
    w = max(w, sliders(q, 11., 3., p));
    w = max(w, beads(q, 17., 1., d, .42, p));
    w = max(w, beads(q, 38., 4., d, .45, p));
    w = max(w, beads(q, 84., 8., d, .62, p));
  }
  o = vec4(s, w, a, d);
}`;

const WASH_COMP_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
uniform sampler2D tA, tB, tH;
uniform float p, uAsp;
${GLSL_COLOR}
${GLSL_NOISE}
float ss(float a, float b, float x){ return smoothstep(a, b, x); }
vec2 worley(vec2 x){
  vec2 n = floor(x), f = fract(x);
  float d1 = 9., d2 = 9.;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(i, j);
      vec2 o2 = .15 + .7 * hash22(n + g);
      float d = dot(g + o2 - f, g + o2 - f);
      if (d < d1) { d2 = d1; d1 = d; }
      else if (d < d2) d2 = d;
    }
  return sqrt(vec2(d1, d2));
}
void main(){
  vec2 q = vUv * vec2(uAsp, 1.);
  vec4 h4 = texture(tH, vUv);
  float a = h4.z, d = h4.w;
  bool dryA = a < -.012 && p < .4;
  bool gone = p > .985;
  if (dryA) {
    float sh = exp((a + .012) * 16.);
    vec3 c = toLin(clamp(texture(tA, vUv).rgb, 0., 1.));
    if (sh < .004) { o = texture(tA, vUv); return; }
    c *= 1. - .30 * sh * ss(0., .08, p);
    o = vec4(toSrgb(c), 1.);
    return;
  }
  if (gone) { o = texture(tB, vUv); return; }
  vec2 tx = 1. / vec2(textureSize(tH, 0));
  float e = tx.y;
  vec2 hl = texture(tH, vUv - vec2(tx.x, 0.)).xy;
  vec2 hr = texture(tH, vUv + vec2(tx.x, 0.)).xy;
  vec2 hd = texture(tH, vUv - vec2(0., tx.y)).xy;
  vec2 hu = texture(tH, vUv + vec2(0., tx.y)).xy;
  vec3 h0 = vec3(h4.xy, h4.x + h4.y);
  vec2 sm = hl + hr + hd + hu;
  if (h0.z <= 0. && sm.x + sm.y <= 0. && p > .4) { o = texture(tB, vUv); return; }
  vec2 gs = vec2(hr.x - hl.x, hu.x - hd.x) / (2. * e);
  vec2 gw = vec2(hr.y - hl.y, hu.y - hd.y) / (2. * e);
  vec2 g = gs + gw;
  float isW = ss(0., .0012, h0.y);
  vec3 n = normalize(vec3(-g, 1.));
  float thick = clamp(h0.x / .085, 0., 2.);
  vec2 off = -gs * .055 * clamp(.5 + thick, 0., 1.6) - clamp(gw, -2.5, 2.5) * .085 * isW;
  off = clamp(off, -.35, .35);
  vec2 uv = vUv + off / vec2(uAsp, 1.);
  uv = abs(uv);
  uv = 1. - abs(1. - uv);
  float lod = clamp(thick * 1.5 + length(gs) * 1.4 - .4, 0., 4.5);
  float sw = ss(.36, .44, p + .02 * (vnoise(q * 4.) - .5));
  vec3 ca = p < .46 ? toLin(clamp(vec3(
    textureLod(tA, uv - .0025 * n.xy, lod).r,
    textureLod(tA, uv, lod).g,
    textureLod(tA, uv + .0025 * n.xy, lod).b
  ), 0., 1.)) : vec3(0.);
  vec3 cb = p > .34 ? toLin(clamp(vec3(
    textureLod(tB, uv - .0025 * n.xy, lod).r,
    textureLod(tB, uv, lod).g,
    textureLod(tB, uv + .0025 * n.xy, lod).b
  ), 0., 1.)) : vec3(0.);
  vec3 c = mix(ca, cb, sw);
  float depth = thick * ss(0., .3, a) * ss(.03, -.25, d);
  float murk = ss(.18, .36, p) * (1. - ss(.45, .66, p));
  // Rosewood obsidian & warm amber-ink glaze
  vec3 ab = exp(-depth * vec3(.48, .92, .78) * (.55 + 1.6 * murk));
  vec3 sc = mix(vec3(.07, .04, .06), vec3(.32, .22, .16), ss(.2, 1.1, thick + n.y * .6));
  c = c * ab + sc * (1. - ab.g) * mix(1.4, .92, murk);
  vec3 body = mix(
    vec3(.06, .035, .05),
    vec3(.28, .19, .15),
    ss(.15, 1.15, thick + n.y * .7 + .35 * (vnoise(q * 6. + vec2(0., -p * 3.)) - .5))
  );
  float bw = fbm(vec2(q.x * 1.6 + 1.4 * vnoise(q * 2.6 + p * 2.), q.y * 5.2 - p * (p < .4 ? 3. : -3.)));
  body *= .55 + .95 * bw + .5 * dot(n, normalize(vec3(-.35, .75, .2)));
  c = mix(c, body, .72 * murk * ss(.0, .5, depth));
  vec3 L = normalize(vec3(-.35, .75, .55)), hv = normalize(L + vec3(0., 0., 1.));
  float fr = pow(1. - n.z, 3.5);
  vec3 sky = mix(vec3(.45, .36, .26), vec3(.98, .92, .80), ss(-.3, .9, n.y));
  c = mix(c, sky, clamp(fr * .75, 0., .6) * (isW > 0. ? .75 : 1.));
  float sp = pow(max(dot(n, hv), 0.), isW > .5 ? 90. : 140.);
  c += vec3(1., .95, .86) * sp * (isW > .5 ? .85 : .55 * ss(0., .3, thick));
  if (isW > 0.) {
    float rim = ss(.45, 1.6, length(gw));
    c *= 1. - .50 * rim * ss(-.2, .9, n.y) * isW;
    c += isW * rim * ss(.1, .9, -n.y) * vec3(.22, .18, .14);
  }
  float foam = 0.;
  if (d < .06 && a > -.02 && p < .84) {
    vec2 fq = q + vec2(-p * .55, p < .4 ? -p * 1.1 : (p - .4) * 1.5);
    vec2 wq = fq + .16 * vec2(fbm(fq * 3.1), fbm(fq * 3.1 + 9.)) + .028 * vec2(vnoise(fq * 19.), vnoise(fq * 19. + 4.));
    float ht = ss(.28, .66, fbm(fq * 4.7 + 11.));
    vec2 w1 = worley(wq * 13.), w2 = worley(wq * 31. + 3.);
    float lace = ss(.03 + .26 * ht, .0, w1.y - w1.x) * .8 + ss(.05 + .34 * ht, .0, w2.y - w2.x) * .75 * (.35 + .65 * ht);
    float fizz = ss(.46, .16, w2.x) * .75 * (.3 + .7 * ht) + ss(.3, .05, w2.x) * .3;
    float pat = fbm(fq * vec2(3.4, 4.2) + 2.);
    float nearLip = exp(-max(a, 0.) * 9.), trail = exp(-max(a, 0.) * 2.0);
    float edgeD = exp(-abs(d + .05) * 15.) * ss(.42, .5, p) * (1. - ss(.66, .82, p));
    float amt = nearLip * 1.35 + trail * .75 * ss(.35, .65, pat) + murk * .95 * ss(.42, .68, pat) + edgeD * .55 * ss(.35, .6, pat);
    amt *= ss(-.012, .02, a) * ss(.03, -.03, d);
    float brk = .35 + 1.1 * ss(.3, .62, fbm(fq * 9.));
    foam = clamp(amt * (.25 + lace * brk + fizz * brk) - .18, 0., 1.);
    foam = max(foam, ss(.035, .0, a) * ss(-.012, .004, a) * (.55 + .45 * fizz) * .9);
    float fs = .70 + .30 * clamp(vnoise(fq * 30.) + .6 * n.y + .25 * w2.x, 0., 1.);
    c = mix(c, vec3(.94, .89, .80) * fs, foam * .92);
  }
  float cover = ss(-.012, .0, a);
  vec3 base = toLin(clamp((p < .4 ? texture(tA, vUv) : texture(tB, vUv)).rgb, 0., 1.));
  float wet = p < .4 ? cover : clamp(ss(0., .0010, h0.z), 0., 1.);
  wet = max(wet, foam);
  c = mix(base, c, wet * (1. - ss(.955, .985, p)));
  o = vec4(toSrgb(min(c, vec3(1.))), 1.);
}`;

const SLAM_DUR = 1.9;
const SLAM_IMPACT_P = 0.285;

const SLAM_FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
uniform sampler2D tA, tB;
uniform vec2 uRes;
uniform float uK, uTau, uAsp, uRing, uDust, uEnd;
uniform vec2 uC, uShake;
uniform float uRot, uZoom;
uniform mat3 uH;
uniform float uFace;
${GLSL_COLOR}
${GLSL_NOISE}
float sm5(float t){
  t = clamp(t, 0., 1.);
  return t * t * t * (t * (t * 6. - 15.) + 10.);
}
vec3 paperTone(vec2 p){
  float f = fbm(p * vec2(70., 64.)) - .5;
  float g = vnoise(p * 430.) - .5;
  float m = fbm(p * 3.) - .5;
  return vec3(.84, .79, .73) * (1. + f * .045 + g * .03 + m * .03);
}
float fibre(vec2 q, float n, float seed, float tau, float px){
  float a = atan(q.y, q.x);
  float u = (a / 6.28318 + .5) * n;
  float acc = 0.;
  for (int j = -1; j <= 1; j++) {
    float id = mod(floor(u) + float(j), n);
    vec2 h = hash22(vec2(id, seed)), h2 = hash22(vec2(id + 40., seed * 3.));
    float rr = .05 + (.25 + 1.25 * h.x) * (1. - exp(-tau * (2.2 + 2. * h2.y)));
    float an = ((id + .2 + .6 * h.y) / n - .5) * 6.28318 + (h2.x - .5) * .25 * tau;
    vec2 c = rr * vec2(cos(an), sin(an));
    vec2 d = q - c;
    float ro = an + (h2.y - .5) * 3. + tau * (h.y - .5) * 16.;
    d = mat2(cos(ro), sin(ro), -sin(ro), cos(ro)) * d;
    float len = .006 + .020 * h2.x * h2.x;
    d.y += d.x * d.x * (h.x - .5) * 50.;
    float w = .0011 + .0008 * h2.y;
    float s = smoothstep(w + px, w - px * .4, abs(d.y)) * smoothstep(len, len * .6, abs(d.x));
    acc = max(acc, s * (.4 + .6 * h.y));
  }
  return acc;
}
void main(){
  vec2 asp = vec2(uAsp, 1.);
  if (uTau < 0.) {
    vec2 d = vUv - uC;
    float z = 1. + .16 * uK * uK + .62 * uK * uK * uK * uK;
    float blur = .16 * uK * uK * uK;
    vec3 c = vec3(0.);
    float j = hash12(gl_FragCoord.xy);
    if (uK < .02) {
      c = toLin(clamp(texture(tA, uC + d / z).rgb, 0., 1.));
    } else {
      for (int i = 0; i < 10; i++) {
        float f = (float(i) + j) / 10. - .5;
        c += toLin(clamp(texture(tA, uC + d / (z * (1. + blur * f))).rgb, 0., 1.));
      }
      c *= .1;
    }
    float rim = smoothstep(.25, .75, length(d * vec2(1., .8)));
    float occ = 1. - .60 * sm5(uK) * rim;
    vec3 q = uH * vec3(vUv * 2. - 1., 1.);
    vec2 uv = q.xy / q.z;
    vec2 e2 = min(uv, 1. - uv) * vec2(uAsp, 1.);
    float e = min(e2.x, e2.y);
    float soft = .004 + .05 * uK;
    float face = q.z > 0. ? smoothstep(-soft, soft, e) : 0.;
    float sh = q.z > 0. ? exp(-max(-e, 0.) * (14. - 6. * uK)) : 0.;
    c *= occ * (1. - .62 * sh * uFace * uK);
    vec3 av = vec3(0.);
    for (int i = 0; i < 5; i++) {
      av += toLin(clamp(textureLod(tA, vec2(.5 + .11 * float(i - 2), .5 + .05 * float((i * 2) % 5 - 2)), 0.).rgb, 0., 1.));
    }
    av /= 5.;
    vec3 hue = clamp(av / max(luma(av), .12), .75, 1.3);
    vec3 pt = paperTone((vUv - uC) * asp * (1.5 - .5 * uK)) * (1. - .10 * (1. - uK));
    pt *= mix(hue, vec3(1.), .35 + .65 * smoothstep(.5, 1., uK));
    pt *= mix(clamp(luma(av) / .84, .72, 1.02), 1., smoothstep(.55, 1., uK));
    pt *= 1. - .16 * rim * uK;
    pt *= .94 + .06 * smoothstep(0., .3, e);
    c = mix(c, pt, face * uFace);
    o = vec4(toSrgb(c), 1.);
    return;
  }
  vec2 d0 = (vUv - .5) * asp;
  float cr = cos(uRot), sr = sin(uRot);
  d0 = mat2(cr, sr, -sr, cr) * d0 / uZoom;
  vec2 uv = d0 / asp + .5 + uShake;
  vec2 q = (uv - uC) * asp;
  float r = length(q);
  vec2 dir = q / max(r, 1e-4);
  float x = r - uRing;
  float amp = exp(-uTau * 2.6);
  float env = exp(-x * x * 38.) * amp;
  float wob = sin(x * 34.) * env;
  float g = (cos(x * 34.) * 34. - 2. * 38. * x * sin(x * 34.)) * env / 34.;
  vec2 off = dir * g * .0085;
  vec2 bu = uv - off / asp;
  vec3 b = toLin(clamp(texture(tB, clamp(bu, 0., 1.)).rgb, 0., 1.));
  vec3 pt = paperTone(q);
  float front = uDust;
  float n = fbm(q * 9.) * .5 + vnoise(q * 120.) * .22 + vnoise(q * 330.) * .28;
  float age = (front - r) * 2.1 + .55;
  float press = smoothstep(n - .10, n + .34, age - .12);
  press = mix(press, 1., uEnd);
  float lb = luma(b);
  float ink = 1. - lb;
  float take = mix(press, smoothstep(.0, .7, press), ink);
  vec3 c = mix(pt, b, take);
  float fresh = press * (1. - smoothstep(.55, 2.1, age)) * (1. - uEnd);
  vec2 px = 1.4 / uRes;
  float lx = luma(texture(tB, clamp(bu + vec2(px.x, 0.), 0., 1.)).rgb)
           - luma(texture(tB, clamp(bu - vec2(px.x, 0.), 0., 1.)).rgb);
  float ly = luma(texture(tB, clamp(bu + vec2(0., px.y), 0., 1.)).rgb)
           - luma(texture(tB, clamp(bu - vec2(0., px.y), 0., 1.)).rgb);
  c *= 1. + fresh * .30 * (lx * .6 - ly);
  c *= 1. - .10 * fresh * (1. - n);
  c *= 1. + dot(dir, normalize(vec2(-.5, .85))) * g * .16 + wob * .03;
  c *= 1. - .10 * exp(-uTau * 5.) * smoothstep(.2, 1.2, r);
  float dr = .16 + 1.5 * (1. - exp(-uTau * 2.4));
  float a = atan(q.y, q.x);
  vec2 pol = vec2(cos(a), sin(a)) * 2.2;
  float dx = (r - dr) / (.10 + .34 * uTau);
  float re = exp(-dx * dx * (dx > 0. ? 3.2 : 1.1)) * exp(-uTau * 2.7) * (1. - uEnd);
  if (re > .006) {
    float dn = fbm(vec3(pol * 1.6, r * 5. - uTau * 3.5)) * .65 + fbm(vec3(pol * 5., r * 13. - uTau * 5.)) * .35;
    float ring = re * smoothstep(.30, .72, dn);
    c = mix(c, vec3(.48, .32, .25) * (.7 + .7 * dn), clamp(ring * .85, 0., .8));
  }
  float fade = exp(-uTau * 1.5) * (1. - smoothstep(.75, 1.1, uTau));
  if (fade > .01) {
    float pxr = 1.2 / uRes.y;
    float s1 = fibre(q, 61., 3., uTau, pxr);
    float s2 = fibre(q, 37., 11., uTau * .8, pxr);
    vec2 so = vec2(.006, -.012) * (1. + uTau);
    float shd = max(fibre(q + so, 61., 3., uTau, pxr * 4.), fibre(q + so, 37., 11., uTau * .8, pxr * 4.));
    c *= 1. - .38 * shd * fade;
    c = mix(c, vec3(.65, .58, .50), max(s1, s2) * fade * .95);
  }
  if (uEnd >= 1.) { o = vec4(texture(tB, vUv).rgb, 1.); return; }
  o = vec4(toSrgb(c), 1.);
}`;

export const PHYSICAL_SHADERS = {
  tear: { vert: TEAR_SHEET_VERT, frag: TEAR_SHEET_FRAG, scrapVert: TEAR_SCRAP_VERT, scrapFrag: TEAR_SCRAP_FRAG, compFrag: TEAR_COMP_FRAG },
  flaps: { bgVert: FULLSCREEN_VERT, bgFrag: FLAP_BG_FRAG, tileVert: FLAP_TILE_VERT, tileFrag: FLAP_TILE_FRAG },
  wash: { heightVert: FULLSCREEN_VERT, heightFrag: WASH_HEIGHT_FRAG, compVert: FULLSCREEN_VERT, compFrag: WASH_COMP_FRAG },
  slam: { vert: FULLSCREEN_VERT, frag: SLAM_FRAG },
} as const;

interface ProgramHandle {
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
}

interface RenderTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
}

class WebGL2TransitionEngine {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  private quadVao!: WebGLVertexArrayObject;
  private tearSheetVao!: WebGLVertexArrayObject;
  private tearSheetCount = 0;
  private tearScrapVao!: WebGLVertexArrayObject;
  private flapTileVao!: WebGLVertexArrayObject;
  private texA!: WebGLTexture;
  private texB!: WebGLTexture;
  private programs: Record<string, ProgramHandle> = {};
  private targets: Record<string, RenderTarget | undefined> = {};
  private width = 0;
  private height = 0;
  private lost = false;

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.lost = true;
    });
    this.initResources();
  }

  static create(): WebGL2TransitionEngine | undefined {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        depth: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
        premultipliedAlpha: true,
      });
    } catch {
      return;
    }
    if (!gl) return;
    try {
      return new WebGL2TransitionEngine(canvas, gl);
    } catch {
      return;
    }
  }

  private compileProgram(vertSrc: string, fragSrc: string, uniformNames: readonly string[]): ProgramHandle {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) throw new Error('createShader failed');
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh) || '';
        gl.deleteShader(sh);
        throw new Error(log);
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    if (!prog) throw new Error('createProgram failed');
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'position');
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) || '';
      gl.deleteProgram(prog);
      throw new Error(log);
    }
    const loc: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) loc[name] = gl.getUniformLocation(prog, name);
    return { prog, loc };
  }

  private compiledKinds = new Set<PhysicalShaderKind>();

  ensurePrograms(kind: PhysicalShaderKind): boolean {
    if (this.lost) return false;
    if (this.compiledKinds.has(kind)) return true;
    try {
      if (kind === 'tear') {
        this.programs.tearSheet = this.compileProgram(TEAR_SHEET_VERT, TEAR_SHEET_FRAG, [
          'tA', 'tB', 'uAsp', 'uP', 'uYf', 'uW2', 'uRes',
        ]);
        this.programs.tearScrap = this.compileProgram(TEAR_SCRAP_VERT, TEAR_SCRAP_FRAG, [
          'uAsp', 'uP', 'uYf', 'uW2', 'uT',
        ]);
        this.programs.maskBlur = this.compileProgram(FULLSCREEN_VERT, MASK_BLUR_FRAG, ['tA', 'uD', 'uCh']);
        this.programs.tearComp = this.compileProgram(FULLSCREEN_VERT, TEAR_COMP_FRAG, ['tB', 'tL', 'tN', 'tF', 'uAsp', 'uS']);
      } else if (kind === 'flaps') {
        this.programs.flapBg = this.compileProgram(FULLSCREEN_VERT, FLAP_BG_FRAG, ['tA', 'tB', 'uGrid', 'uT', 'uRes']);
        this.programs.flapTile = this.compileProgram(FLAP_TILE_VERT, FLAP_TILE_FRAG, ['tA', 'tB', 'uGrid', 'uT', 'uAsp', 'uRes']);
      } else if (kind === 'wash') {
        this.programs.washHeight = this.compileProgram(FULLSCREEN_VERT, WASH_HEIGHT_FRAG, ['p', 'uAsp']);
        this.programs.washComp = this.compileProgram(FULLSCREEN_VERT, WASH_COMP_FRAG, ['tA', 'tB', 'tH', 'p', 'uAsp']);
      } else if (kind === 'slam') {
        this.programs.slam = this.compileProgram(FULLSCREEN_VERT, SLAM_FRAG, [
          'tA', 'tB', 'uRes', 'uK', 'uTau', 'uAsp', 'uRing', 'uDust', 'uEnd', 'uC', 'uShake', 'uRot', 'uZoom', 'uH', 'uFace',
        ]);
      }
      this.compiledKinds.add(kind);
      return true;
    } catch {
      return false;
    }
  }

  private initResources(): void {
    const gl = this.gl;

    // 1. Fullscreen quad VAO (triangles covering [0,1]^2)
    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // 2. Tear curling sheet dual-half grid VAO (pos loc = 0)
    this.tearSheetVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.tearSheetVao);
    const verts: number[] = [];
    const indices: number[] = [];
    for (const sg of [-1, 1]) {
      const base = verts.length / 3;
      for (let ix = 0; ix <= TEAR_SEG_X; ix++) {
        for (let iy = 0; iy <= TEAR_SEG_Y; iy++) {
          verts.push(ix / TEAR_SEG_X, iy / TEAR_SEG_Y, sg);
        }
      }
      for (let ix = 0; ix < TEAR_SEG_X; ix++) {
        for (let iy = 0; iy < TEAR_SEG_Y; iy++) {
          const s = base + ix * (TEAR_SEG_Y + 1) + iy;
          const m = s + TEAR_SEG_Y + 1;
          if (sg < 0) indices.push(s, m, m + 1, s, m + 1, s + 1);
          else indices.push(s, m + 1, m, s, s + 1, m + 1);
        }
      }
    }
    const tearVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, tearVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const tearIbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tearIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
    this.tearSheetCount = indices.length;

    // 3. Instanced quad VAO for tear scraps ([-1,1]^2)
    this.tearScrapVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.tearScrapVao);
    const scrapVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, scrapVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const scrapIbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, scrapIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

    // 4. Instanced unit quad VAO for split-flap tiles ([0,1]^2)
    this.flapTileVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.flapTileVao);
    const flapVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, flapVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const flapIbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, flapIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    this.texA = this.makeTexture(true);
    this.texB = this.makeTexture(true);
  }

  private makeTexture(mipmaps: boolean): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([16, 13, 19, 255]));
    if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }

  private ensureTarget(name: string, width: number, height: number): RenderTarget {
    const gl = this.gl;
    const existing = this.targets[name];
    if (existing && existing.width === width && existing.height === height) return existing;
    if (existing) {
      gl.deleteFramebuffer(existing.fbo);
      gl.deleteTexture(existing.tex);
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const rt = { fbo, tex, width, height };
    this.targets[name] = rt;
    return rt;
  }

  resize(cssWidth: number, cssHeight: number): { width: number; height: number; aspect: number } {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.canvas.width = width;
      this.canvas.height = height;
    }
    return { width, height, aspect: width / Math.max(1, height) };
  }

  uploadTexture(which: 'A' | 'B', source: TexImageSource, mipmap = true): void {
    if (this.lost) return;
    const gl = this.gl;
    const tex = which === 'A' ? this.texA : this.texB;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    if (mipmap) gl.generateMipmap(gl.TEXTURE_2D);
  }

  seedSolid(which: 'A' | 'B', r = 16, g = 13, b = 19): void {
    if (this.lost) return;
    const gl = this.gl;
    const tex = which === 'A' ? this.texA : this.texB;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([r, g, b, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  render(kind: PhysicalShaderKind, p: number): boolean {
    if (this.lost || !this.ensurePrograms(kind)) return false;
    const w = this.width, h = this.height, aspect = w / Math.max(1, h);
    if (kind === 'tear') return this.renderTear(p, w, h, aspect);
    if (kind === 'flaps') return this.renderFlaps(p, w, h, aspect);
    if (kind === 'wash') return this.renderWash(p, w, h, aspect);
    return this.renderSlam(p, w, h, aspect);
  }

  private bindTex(unit: number, tex: WebGLTexture, uniformLoc: WebGLUniformLocation | null): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uniformLoc, unit);
  }

  private drawQuad(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private renderTear(p: number, w: number, h: number, aspect: number): boolean {
    const gl = this.gl;
    const layer = this.ensureTarget('tearLayer', w, h);
    const nw = Math.max(1, Math.round(w * 0.25)), nh = Math.max(1, Math.round(h * 0.25));
    const fw = Math.max(1, Math.round(w * 0.125)), fh = Math.max(1, Math.round(h * 0.125));
    const pingNear = this.ensureTarget('pingNear', nw, nh);
    const near = this.ensureTarget('near', nw, nh);
    const pingFar = this.ensureTarget('pingFar', fw, fh);
    const far = this.ensureTarget('far', fw, fh);

    let s = invLerp(0.02, 0.56, p);
    s = lerp(s, smoothstep01(s), 0.55);
    s += (0.012 * Math.sin(s * 26) + 0.005 * Math.sin(s * 61)) * Math.sin(Math.PI * s);
    const yf = 1.08 - 2.4 * s;
    const open = invLerp(0.37, 0.995, p);
    const w2 = (aspect + 0.98) * Math.pow(open, 2.1) * (1.35 - 0.35 * open);
    const tSec = p * TEAR_DUR;

    // 1. Render torn curling sheets + 46 fluttering confetti scraps into tearLayer
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.fbo);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const sp = this.programs.tearSheet;
    gl.useProgram(sp.prog);
    this.bindTex(0, this.texA, sp.loc.tA);
    this.bindTex(1, this.texB, sp.loc.tB);
    gl.uniform1f(sp.loc.uAsp, aspect);
    gl.uniform1f(sp.loc.uP, p);
    gl.uniform1f(sp.loc.uYf, yf);
    gl.uniform1f(sp.loc.uW2, w2);
    gl.uniform2f(sp.loc.uRes, w, h);
    gl.bindVertexArray(this.tearSheetVao);
    gl.drawElements(gl.TRIANGLES, this.tearSheetCount, gl.UNSIGNED_INT, 0);

    const sc = this.programs.tearScrap;
    gl.useProgram(sc.prog);
    gl.uniform1f(sc.loc.uAsp, aspect);
    gl.uniform1f(sc.loc.uP, p);
    gl.uniform1f(sc.loc.uYf, yf);
    gl.uniform1f(sc.loc.uW2, w2);
    gl.uniform1f(sc.loc.uT, tSec);
    gl.bindVertexArray(this.tearScrapVao);
    gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, TEAR_SCRAPS);

    // 2. Separable 2-tier Gaussian mask blur (near + far cast shadow)
    gl.disable(gl.BLEND);
    const blur = this.programs.maskBlur;
    gl.useProgram(blur.prog);
    const runBlur = (srcTex: WebGLTexture, rt: RenderTarget, dx: number, dy: number, ch: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
      gl.viewport(0, 0, rt.width, rt.height);
      this.bindTex(0, srcTex, blur.loc.tA);
      gl.uniform2f(blur.loc.uD, dx, dy);
      gl.uniform1f(blur.loc.uCh, ch);
      this.drawQuad();
    };
    const radius = 0.007;
    runBlur(layer.tex, pingNear, (radius / aspect) * 0.35, 0, 1);
    runBlur(pingNear.tex, near, 0, radius * 0.35, 0);
    runBlur(near.tex, pingFar, (radius / aspect) * 1.1, 0, 0);
    runBlur(pingFar.tex, far, 0, radius * 1.1, 0);

    // 3. Final composite over scene B with near + far shadow
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    const comp = this.programs.tearComp;
    gl.useProgram(comp.prog);
    this.bindTex(0, this.texB, comp.loc.tB);
    this.bindTex(1, layer.tex, comp.loc.tL);
    this.bindTex(2, near.tex, comp.loc.tN);
    this.bindTex(3, far.tex, comp.loc.tF);
    gl.uniform1f(comp.loc.uAsp, aspect);
    gl.uniform1f(comp.loc.uS, 1 - smoothstep01(invLerp(0.88, 0.985, p)));
    this.drawQuad();
    gl.bindVertexArray(null);
    return true;
  }

  private renderFlaps(p: number, w: number, h: number, aspect: number): boolean {
    const gl = this.gl;
    const rows = aspect < 1 ? 14 : FLAP_ROWS;
    const cols = Math.max(4, Math.round((aspect * rows) / (aspect < 1 ? 0.65 : 16 / 9)));
    const tSec = p * FLAPS_DUR;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    // Background tile grid + hinge cast shadow
    gl.disable(gl.DEPTH_TEST);
    const bg = this.programs.flapBg;
    gl.useProgram(bg.prog);
    this.bindTex(0, this.texA, bg.loc.tA);
    this.bindTex(1, this.texB, bg.loc.tB);
    gl.uniform2f(bg.loc.uGrid, cols, rows);
    gl.uniform1f(bg.loc.uT, tSec);
    gl.uniform2f(bg.loc.uRes, w, h);
    this.drawQuad();

    // Instanced 3D rotating card halves with depth occlusion
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.clearDepth(1.0);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const fl = this.programs.flapTile;
    gl.useProgram(fl.prog);
    this.bindTex(0, this.texA, fl.loc.tA);
    this.bindTex(1, this.texB, fl.loc.tB);
    gl.uniform2f(fl.loc.uGrid, cols, rows);
    gl.uniform1f(fl.loc.uT, tSec);
    gl.uniform1f(fl.loc.uAsp, aspect);
    gl.uniform2f(fl.loc.uRes, w, h);
    gl.bindVertexArray(this.flapTileVao);
    gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, cols * rows);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(null);
    return true;
  }

  private renderWash(p: number, w: number, h: number, aspect: number): boolean {
    const gl = this.gl;
    const hw = Math.max(1, Math.round(w * 0.66)), hh = Math.max(1, Math.round(h * 0.66));
    const heightRt = this.ensureTarget('washHeight', hw, hh);

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, heightRt.fbo);
    gl.viewport(0, 0, hw, hh);
    const hp = this.programs.washHeight;
    gl.useProgram(hp.prog);
    gl.uniform1f(hp.loc.p, p);
    gl.uniform1f(hp.loc.uAsp, aspect);
    this.drawQuad();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    const cp = this.programs.washComp;
    gl.useProgram(cp.prog);
    this.bindTex(0, this.texA, cp.loc.tA);
    this.bindTex(1, this.texB, cp.loc.tB);
    this.bindTex(2, heightRt.tex, cp.loc.tH);
    gl.uniform1f(cp.loc.p, p);
    gl.uniform1f(cp.loc.uAsp, aspect);
    this.drawQuad();
    gl.bindVertexArray(null);
    return true;
  }

  private renderSlam(p: number, w: number, h: number, aspect: number): boolean {
    const gl = this.gl;
    const preK = invLerp(0, SLAM_IMPACT_P, p);
    const tau = (p - SLAM_IMPACT_P) * SLAM_DUR;
    const sp = this.programs.slam;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    gl.useProgram(sp.prog);
    this.bindTex(0, this.texA, sp.loc.tA);
    this.bindTex(1, this.texB, sp.loc.tB);
    gl.uniform2f(sp.loc.uRes, w, h);
    gl.uniform1f(sp.loc.uK, preK);
    gl.uniform1f(sp.loc.uTau, tau);
    gl.uniform1f(sp.loc.uAsp, aspect);
    gl.uniform2f(sp.loc.uC, 0.5, 0.46);

    if (tau < 0) {
      const f = 0.93 + 0.75 * preK * preK * preK;
      const hw = (1 - preK) * 0.16;
      const cx = 0, cy = -0.04;
      const hom =
        solveHomography([
          [cx - f * (1 + hw), cy + f * 1.02],
          [cx + f * (1 + hw), cy + f * 1.02],
          [cx + f * (1 - hw), cy - f],
          [cx - f * (1 - hw), cy - f],
        ]) ?? new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      gl.uniformMatrix3fv(sp.loc.uH, false, hom);
      gl.uniform1f(sp.loc.uFace, smoothstep01(invLerp(0.42, 1, preK)));
      gl.uniform2f(sp.loc.uShake, 0, 0);
      gl.uniform1f(sp.loc.uRot, 0);
      gl.uniform1f(sp.loc.uZoom, 1);
      gl.uniform1f(sp.loc.uRing, 0);
      gl.uniform1f(sp.loc.uDust, 0);
      gl.uniform1f(sp.loc.uEnd, 0);
    } else {
      const decay = Math.exp(-tau * 6.5);
      const phase = tau * 34;
      gl.uniform2f(sp.loc.uShake, Math.sin(phase + 0.4) * 0.0085 * decay, Math.cos(phase * 1.27) * 0.016 * decay);
      gl.uniform1f(sp.loc.uRot, Math.sin(phase * 0.9 + 1) * 0.007 * decay);
      gl.uniform1f(sp.loc.uZoom, 1 + 0.035 * Math.exp(-tau * 9) * Math.cos(tau * 26) + 0.004 * decay);
      gl.uniform1f(sp.loc.uRing, 0.06 + 1.75 * (1 - Math.exp(-tau * 2.3)));
      gl.uniform1f(sp.loc.uDust, 2.9 * (1 - Math.exp(-tau * 2.6)) - 0.42);
      gl.uniform1f(sp.loc.uEnd, smoothstep01(clamp01((p - 0.86) / 0.125)));
      gl.uniform1f(sp.loc.uFace, 0);
    }
    this.drawQuad();
    gl.bindVertexArray(null);
    return true;
  }

  destroy(): void {
    const gl = this.gl;
    for (const rt of Object.values(this.targets)) {
      if (rt) {
        gl.deleteFramebuffer(rt.fbo);
        gl.deleteTexture(rt.tex);
      }
    }
    this.targets = {};
    for (const p of Object.values(this.programs)) gl.deleteProgram(p.prog);
    this.programs = {};
    if (this.texA) gl.deleteTexture(this.texA);
    if (this.texB) gl.deleteTexture(this.texB);
    this.canvas.remove();
  }
}

let sharedEngine: WebGL2TransitionEngine | null | undefined;
function getEngine(game?: Phaser.Game): WebGL2TransitionEngine | undefined {
  if (sharedEngine === null) return;
  if (!sharedEngine) {
    sharedEngine = WebGL2TransitionEngine.create() ?? null;
    if (!sharedEngine) return;
    game?.events?.once?.('destroy', () => {
      sharedEngine?.destroy();
      sharedEngine = undefined;
    });
  }
  return sharedEngine ?? undefined;
}

/** Lazily pre-compile each physical transition shader across staggered idle slices after boot. */
export function warmCinematicTransitions(game?: Phaser.Game): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (game && game.renderer?.type !== 2) return;
  const order: readonly PhysicalShaderKind[] = ['tear', 'flaps', 'wash', 'slam'];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const cancelAll = () => {
    for (const id of timers) clearTimeout(id);
  };
  game?.events?.once?.('destroy', cancelAll);
  order.forEach((kind, index) => {
    const id = setTimeout(() => {
      if (document.hidden) return;
      if (game && game.renderer?.type !== 2) return;
      getEngine(game)?.ensurePrograms(kind);
    }, 300 + index * 380);
    timers.push(id);
  });
}

/** Synthesize a snapshot when leaving the HTML TitleScene so cover transitions tear open real artwork. */
function captureOutgoingSource(scene: Phaser.Scene, w: number, h: number): TexImageSource | undefined {
  const isTitle = scene.scene?.key === 'title' || !!document.querySelector('.title-home');
  if (isTitle) {
    const snap = document.createElement('canvas');
    snap.width = Math.max(1, Math.min(w, 1280));
    snap.height = Math.max(1, Math.round((snap.width * h) / Math.max(1, w)));
    const c = snap.getContext('2d');
    if (c) {
      const grad = c.createLinearGradient(0, 0, 0, snap.height);
      grad.addColorStop(0, '#1e1622');
      grad.addColorStop(0.76, '#141018');
      grad.addColorStop(1, '#100c14');
      c.fillStyle = grad;
      c.fillRect(0, 0, snap.width, snap.height);
      const heroH = snap.height * 0.78;
      const img = document.querySelector<HTMLImageElement>('.home-hero .load-world img, .load-scene .load-world img');
      if (img && img.complete && img.naturalWidth > 0) {
        const scale = Math.max(snap.width / img.naturalWidth, heroH / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        c.save();
        c.beginPath();
        c.rect(0, 0, snap.width, heroH);
        c.clip();
        c.drawImage(img, (snap.width - dw) * 0.54, 0, dw, dh);
        const scrim = c.createLinearGradient(0, 0, 0, heroH);
        scrim.addColorStop(0, 'rgba(18,13,22,0.28)');
        scrim.addColorStop(1, 'rgba(16,11,20,0.88)');
        c.fillStyle = scrim;
        c.fillRect(0, 0, snap.width, heroH);
        c.restore();
      }
      // Match the centered scroll plaque and rosewood entry dock of HomePage.
      const sx = snap.width * 0.085, sy = snap.height * 0.145, sw = snap.width * 0.83, sh = snap.height * 0.50;
      c.fillStyle = '#fcf6e8';
      c.fillRect(sx, sy, sw, sh);
      c.strokeStyle = 'rgba(216,180,108,0.85)';
      c.lineWidth = 3;
      c.strokeRect(sx, sy, sw, sh);
      c.fillStyle = '#8b6633';
      c.fillRect(sx - 12, sy - 6, 12, sh + 12);
      c.fillRect(sx + sw, sy - 6, 12, sh + 12);
      c.fillStyle = '#19151d';
      c.font = `700 ${Math.round(snap.width * 0.044)}px "Tangsongpai Brush","PingFang SC",serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('唐 宋 牌', snap.width * 0.5, sy + sh * 0.25);
      c.strokeStyle = 'rgba(216,180,108,0.65)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, heroH);
      c.lineTo(snap.width, heroH);
      c.stroke();
      return snap;
    }
  }
  const gc = scene.game?.canvas;
  if (gc && gc.width > 0 && gc.height > 0) return gc;
  return undefined;
}

export interface ActiveCinematicTransition {
  canvas: HTMLCanvasElement;
  stop: () => void;
}

export function startCinematicWebGLTransition(
  scene: Phaser.Scene,
  shaderKind: PhysicalShaderKind,
  rawKind: string,
  durationMs: number,
  zIndex: number,
  onDone: () => void,
): ActiveCinematicTransition | undefined {
  const engine = getEngine(scene.game);
  if (!engine || !engine.ensurePrograms(shaderKind)) return;
  const { width, height } = engine.resize(window.innerWidth || 1280, window.innerHeight || 720);
  const canvas = engine.canvas;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.paperTransition = rawKind;
  canvas.dataset.transitionShader = shaderKind;
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    zIndex: String(zIndex),
    pointerEvents: 'none',
    display: 'block',
  });

  const outSource = captureOutgoingSource(scene, width, height);
  if (outSource) engine.uploadTexture('A', outSource, shaderKind === 'wash');
  else engine.seedSolid('A');
  engine.seedSolid('B');

  document.body.append(canvas);

  let rafId = 0;
  let stopped = false;
  let startTime: number | undefined;
  let frameIndex = 0;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    canvas.remove();
    onDone();
  };

  const tick = (now: number) => {
    if (stopped) return;
    if (startTime === undefined) startTime = now;
    const elapsed = now - startTime;
    const p = clamp01(elapsed / Math.max(1, durationMs));
    frameIndex++;
    // Wait one tick after beginPaperTransition so scene.scene.start mounts the incoming scene into game.canvas.
    if (frameIndex >= 2) {
      const gc = scene.game?.canvas;
      if (gc && gc.width > 0 && gc.height > 0) {
        engine.uploadTexture('B', gc, shaderKind === 'wash');
      }
    }
    const ok = engine.render(shaderKind, Math.max(0.001, p));
    if (!ok || p >= 1) {
      finish();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  // Paint first frame synchronously so the outgoing frame is locked on screen before navigation starts.
  engine.render(shaderKind, 0.001);
  rafId = requestAnimationFrame(tick);

  return { canvas, stop: finish };
}
