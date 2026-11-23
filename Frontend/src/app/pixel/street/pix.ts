// Pixel toolkit: indexed sprites drawn at art resolution, shaded with
// hue-shifted 4-tone ramps and finished with a selective outline.
const INK = '#17121c';
type Col = string | null;
type Ramp = readonly string[];
type Rgb = [number, number, number];

const R = {
  brick: ['#3e1f2b', '#6e2f33', '#9a4537', '#c26a45'],
  mauve: ['#2e2233', '#4b3044', '#6c4555', '#8e6168'],
  tan: ['#3f2c26', '#6e4c34', '#9c7449', '#c49e68'],
  concrete: ['#34303d', '#55505f', '#7a7382', '#a39aa3'],
  asphalt: ['#1b1820', '#25212c', '#312c38', '#433d4b'],
  steel: ['#22303f', '#3a5063', '#5a7b8a', '#8db0b0'],
  rust: ['#4f231d', '#843f25', '#b5642e', '#db9a4a'],
  sign: ['#173328', '#2a5a3c', '#4a8a4a', '#8cc063'],
  taxi: ['#5e3f12', '#a8731a', '#dcad2c', '#f6dc6a'],
  skinA: ['#5a3328', '#8a5038', '#b97a55', '#dba57a'],
  skinB: ['#2f1d1c', '#523327', '#7a4f37', '#9f6f4a'],
  skinC: ['#6a3f2e', '#a0664a', '#cf9a72', '#ecc59c'],
  denim: ['#1b2240', '#2b3a66', '#43598c', '#6f86b0'],
  red: ['#43142a', '#7a2034', '#b0383a', '#d9644a'],
  wood: ['#3f2a1e', '#6f4a2e', '#a07444', '#c9a064'],
  gold: ['#5a3a10', '#a06a14', '#d9a520', '#f8e080'],
  paper: ['#7a6f62', '#a89d8a', '#d2c7b0', '#ece4d0'],
  green: ['#1c3326', '#2c5034', '#467a3c', '#78a850'],
  purple: ['#24183a', '#3e2a5c', '#64438a', '#9070b8'],
  plum: ['#1f1424', '#33203a', '#4a2f52', '#674470'],
  olive: ['#2a2a1e', '#46452c', '#6a6a3a', '#95905a'],
  white: ['#8a8794', '#b9b5c0', '#dedae2', '#f6f3f6'],
  black: ['#0f0c14', '#1d1924', '#2c2735', '#403a4a'],
  glass: ['#141522', '#1f2236', '#2e3550', '#4a5878'],
  lit: ['#8a5a2a', '#c98a3a', '#f2c66d', '#ffe9a8'],
  hair: ['#140f14', '#2a1d1c', '#43302a', '#5e463a'],
  blond: ['#5a3e1c', '#9a7432', '#c9a450', '#ead27e'],
  grey: ['#3a3842', '#5e5b68', '#8a8794', '#b5b2bc'],
  sodium: ['#4a2a10', '#8a4a14', '#d9822a', '#ffc070'],
  teal: ['#142426', '#1f3a3a', '#315a54', '#4f8072'],
  bile: ['#26261a', '#3a3b24', '#545532', '#767446'],
  cream: ['#5e4e3a', '#9c8862', '#cfbd90', '#efe2bc'],
  leather: ['#110e14', '#201a24', '#332a38', '#4a3e50'],
  gum: ['#5a1a3a', '#a03a6a', '#e070a0', '#ffb0d0'],
  coat: ['#261a14', '#45301f', '#664730', '#8c6843'],
  hoodie: ['#3e1c12', '#7a3416', '#b8581e', '#e88a3e'],
  moss: ['#1a2418', '#2c3c26', '#46603a', '#6e8a52'],
};

const rampOf = new Map<string, { ramp: Ramp; i: number }>();
for (const ramp of Object.values(R))
  ramp.forEach((c, i) => {
    if (!rampOf.has(c)) rampOf.set(c, { ramp, i });
  });

const toRgb = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const toHex = ([r, g, b]: Rgb) =>
  '#' +
  [r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const mix = (a: string, b: string, t: number) => {
  const A = toRgb(a),
    B = toRgb(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
};

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bayer = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;

let seed = 1;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const srand = (s: number) => {
  seed = s >>> 0 || 1;
};
const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

class Sprite {
  w: number;
  h: number;
  c: Col[];
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.c = new Array<Col>(w * h).fill(null);
  }
  in(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number): Col {
    return this.in(x, y) ? this.c[y * this.w + x] : null;
  }
  set(x: number, y: number, col: Col) {
    x = Math.round(x);
    y = Math.round(y);
    if (this.in(x, y)) this.c[y * this.w + x] = col;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, col: Col) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
    return this;
  }
  hline(x: number, y: number, w: number, col: Col) {
    return this.rect(x, y, w, 1, col);
  }
  vline(x: number, y: number, h: number, col: Col) {
    return this.rect(x, y, 1, h, col);
  }
  line(x0: number, y0: number, x1: number, y1: number, col: Col) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0),
      dy = -Math.abs(y1 - y0),
      sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }
  each(fn: (x: number, y: number, c: Col) => void) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) fn(x, y, this.c[y * this.w + x]);
  }
  stamp(o: Sprite, dx: number, dy: number) {
    o.each((x, y, c) => {
      if (c) this.set(x + dx, y + dy, c);
    });
    return this;
  }
  flipX() {
    const s = new Sprite(this.w, this.h);
    this.each((x, y, c) => {
      s.c[y * s.w + (s.w - 1 - x)] = c;
    });
    return s;
  }
  clone() {
    const s = new Sprite(this.w, this.h);
    s.c = this.c.slice();
    return s;
  }
  dither(x: number, y: number, w: number, h: number, colA: Col, colB: Col, level: number) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) this.set(x + i, y + j, bayer(x + i, y + j) < level ? colB : colA);
    return this;
  }
  tint(
    x: number,
    y: number,
    w: number,
    h: number,
    col: string,
    t: number,
    test?: (x: number, y: number) => boolean,
  ) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const c = this.get(x + i, y + j);
        if (c && (!test || test(x + i, y + j))) this.set(x + i, y + j, mix(c, col, t));
      }
    return this;
  }
  // Selective outline: the lit (top/left) side takes the darkest tone of the
  // neighbouring ramp, the shadow side takes the ink.
  outline(opts: { ink?: string; skip?: Set<string>; selective?: boolean } = {}) {
    const ink = opts.ink || INK,
      src = this.clone(),
      skip = opts.skip || new Set();
    const solid = (x: number, y: number) => {
      const c = src.get(x, y);
      return c && !skip.has(c);
    };
    this.each((x, y) => {
      if (src.get(x, y)) return;
      const below = solid(x, y + 1) ? src.get(x, y + 1) : null;
      const right = solid(x + 1, y) ? src.get(x + 1, y) : null;
      const above = solid(x, y - 1),
        left = solid(x - 1, y);
      if (!below && !right && !above && !left) return;
      if (opts.selective !== false && (below || right) && !above && !left) {
        const info = rampOf.get((below || right)!);
        this.set(x, y, info ? info.ramp[0] : ink);
        return;
      }
      this.set(x, y, ink);
    });
    return this;
  }
  canvas() {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!,
      img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.c.length; i++) {
      const c = this.c[i];
      if (!c) continue;
      const [r, g, b] = toRgb(c);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

function toneFor(edges: { top: boolean; bottom: boolean; left: boolean; right: boolean }) {
  if (edges.top) return 3;
  if (edges.bottom || edges.right) return 1;
  if (edges.left) return 3;
  return 2;
}

// Bevel shading for any shape given as a membership test.
interface ShapeOpts {
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  band?: number;
  flatTop?: boolean;
}
function shape(
  s: Sprite,
  test: (x: number, y: number) => boolean,
  ramp: Ramp,
  opts: ShapeOpts = {},
) {
  const x0 = opts.x0 ?? 0,
    y0 = opts.y0 ?? 0,
    x1 = opts.x1 ?? s.w,
    y1 = opts.y1 ?? s.h,
    band = opts.band ?? 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (!test(x, y)) continue;
      const edges = {
        top: !test(x, y - 1),
        bottom: !test(x, y + 1),
        left: !test(x - 1, y),
        right: !test(x + 1, y),
      };
      let t = toneFor(edges);
      if (band && t === 2 && (!test(x + band, y) || !test(x, y + band))) t = 1;
      if (opts.flatTop && edges.top) t = 2;
      s.set(x, y, ramp[t]);
    }
  return s;
}
const box = (
  s: Sprite,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: Ramp,
  opts: ShapeOpts = {},
) =>
  shape(s, (i, j) => i >= x && i < x + w && j >= y && j < y + h, ramp, {
    ...opts,
    x0: x - 1,
    y0: y - 1,
    x1: x + w + 1,
    y1: y + h + 1,
  });

function sphereTone(d: number) {
  if (d > 0.93) return 4;
  if (d > 0.72) return 3;
  if (d > 0.38) return 2;
  if (d > 0.05) return 1;
  return 0;
}
function sphere(s: Sprite, cx: number, cy: number, r: number, ramp: Ramp, spec?: string) {
  const L = [-0.52, -0.62, 0.59];
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const nx = (x + 0.5 - cx) / r,
        ny = (y + 0.5 - cy) / r,
        q = nx * nx + ny * ny;
      if (q > 1) continue;
      const d = nx * L[0] + ny * L[1] + Math.sqrt(1 - q) * L[2],
        t = sphereTone(d);
      s.set(x, y, t === 4 ? spec || ramp[3] : ramp[t]);
    }
  return s;
}
function cylTone(f: number) {
  if (f < 0.12) return 2;
  if (f < 0.4) return 3;
  if (f < 0.72) return 2;
  if (f < 0.9) return 1;
  return 0;
}
function cylV(s: Sprite, x: number, y: number, w: number, h: number, ramp: Ramp) {
  for (let i = 0; i < w; i++) {
    const t = cylTone((i + 0.5) / w);
    s.vline(x + i, y, h, ramp[t]);
  }
  return s;
}
function cylH(s: Sprite, x: number, y: number, w: number, h: number, ramp: Ramp) {
  for (let j = 0; j < h; j++) {
    const t = cylTone((j + 0.5) / h);
    s.hline(x, y + j, w, ramp[t]);
  }
  return s;
}
const disc = (s: Sprite, cx: number, cy: number, r: number, col: Col) => {
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++)
    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++)
      if ((x + 0.5) ** 2 + (y + 0.5) ** 2 <= r * r)
        s.set(Math.floor(cx) + x, Math.floor(cy) + y, col);
  return s;
};

// Text rendered from a pixel font at its native size and thresholded,
// so glyphs land on the art grid with no anti-aliasing.
const textCanvas = document.createElement('canvas');
textCanvas.width = 512;
textCanvas.height = 64;
const tctx = textCanvas.getContext('2d', { willReadFrequently: true })!;
type FontKey = 'tiny' | 'micro' | 'jersey' | 'black';
const FONTS: Record<FontKey, string> = {
  tiny: '8px "Tiny5"',
  micro: '11px "Micro 5"',
  jersey: '27px "Jersey 15"',
  black: '21px "Jacquard 12"',
};
const ASC: Record<FontKey, number> = { tiny: 7, micro: 9, jersey: 22, black: 17 };
function measure(str: string, font: FontKey = 'tiny') {
  tctx.font = FONTS[font];
  return Math.round(tctx.measureText(str).width);
}
function glyphMask(str: string, font: FontKey = 'tiny') {
  tctx.clearRect(0, 0, 512, 64);
  tctx.font = FONTS[font];
  tctx.fillStyle = '#000';
  tctx.textBaseline = 'alphabetic';
  tctx.fillText(str, 1, ASC[font] + 2);
  const w = Math.min(510, measure(str, font) + 2),
    d = tctx.getImageData(0, 0, w + 2, 40).data,
    pts: [number, number][] = [];
  let top = 99,
    bottom = -1;
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < w + 2; x++)
      if (d[(y * (w + 2) + x) * 4 + 3] >= 128) {
        pts.push([x - 1, y]);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  return { pts, w: w - 2, top, bottom };
}
function text(
  s: Sprite,
  str: string,
  x: number,
  y: number,
  col: Col | ((px: number, py: number, h: number) => Col),
  font: FontKey = 'tiny',
  opts: { alignTop?: boolean; shadow?: string } = {},
) {
  const m = glyphMask(str, font),
    oy = opts.alignTop ? -m.top : -(ASC[font] + 2);
  for (const [px, py] of m.pts) {
    if (opts.shadow) s.set(x + px + 1, y + py + oy + 1, opts.shadow);
  }
  for (const [px, py] of m.pts)
    s.set(
      x + px,
      y + py + oy,
      typeof col === 'function' ? col(px, py - m.top, m.bottom - m.top) : col,
    );
  return m;
}

export type { Col, Ramp, FontKey };
export {
  INK,
  R,
  mix,
  toRgb,
  bayer,
  rand,
  srand,
  ri,
  Sprite,
  shape,
  box,
  sphere,
  cylV,
  cylH,
  disc,
  text,
  measure,
  glyphMask,
  rampOf,
};
