// The dust of the shop. A clump is a few overlapping solid blobs in three tones of the room's
// dust, lit on top. Five frames grow and loosen it, and the room steps its alpha down per frame.
interface Base {
  x: number;
  y: number;
  t0: number;
  life: number;
}
export type Part =
  | (Base & { k: 'clump'; r: number; vx: number; vy: number })
  | (Base & { k: 'mote'; src?: 'cold' | 'warm'; vx: number; vy: number })
  | (Base & { k: 'spark' });

export const CLUMP_ALPHA = [0.75, 0.66, 0.52, 0.36, 0.18];
const MAX_PARTS = 220;

// Each frame is a dense core in three tones inside a looser halo at a third of the alpha.
// Over the five frames the core shrinks and the halo grows, so the clump thins as it spreads.
export function clumpFrames(r: number): HTMLCanvasElement[] {
  const blobs = [
    [0, 0, 1],
    [-0.7, 0.25, 0.72],
    [0.75, 0.2, 0.68],
    [0.15, -0.55, 0.62],
  ];
  const frames = [
    [0.55, 0.75],
    [0.78, 1.0],
    [0.85, 1.2],
    [0.7, 1.32],
    [0.45, 1.4],
  ];
  return frames.map(([core, halo]) => {
    const n = Math.ceil(r * halo * 2.1) + 2,
      w = n * 2;
    const inside = (x: number, y: number, g: number) =>
      blobs.some(
        ([bx, by, br]) =>
          Math.hypot(x + 0.5 - n - bx * r * g, (y + 0.5 - n - by * r * g * 0.8) * 1.15) <=
          br * r * g,
      );
    const c = document.createElement('canvas');
    c.width = w;
    c.height = w;
    const g2 = c.getContext('2d')!,
      img = g2.createImageData(w, w);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        let col: number[] | null = null,
          a = 255;
        if (inside(x, y, core)) {
          const top = !inside(x, y - 2, core),
            bot = !inside(x, y + 2, core);
          col = [174, 164, 142];
          if (top && !bot) col = [214, 205, 184];
          else if (bot) col = [140, 131, 113];
        } else if (inside(x, y, halo)) {
          col = [174, 164, 142];
          a = 85;
        }
        if (!col) continue;
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = a;
      }
    g2.putImageData(img, 0, 0);
    return c;
  });
}

export function stepParts(parts: Part[], dt: number, T: number): Part[] {
  for (const p of parts) {
    if (T < p.t0) continue;
    if (p.k === 'spark') continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.k === 'clump') p.vx *= 1 - dt * 1.4;
    if (p.k === 'mote') p.x += Math.sin(T * 1.3 + p.y) * dt * 1.5;
  }
  const live = parts.filter((p) => T - p.t0 < p.life);
  if (live.length > MAX_PARTS) live.splice(0, live.length - MAX_PARTS);
  return live;
}
