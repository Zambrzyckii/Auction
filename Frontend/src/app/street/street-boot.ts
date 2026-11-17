import type { SceneOptions } from './scene';
import { fontsReady } from './fonts';

export interface SceneHandle {
  resize(): void;
  destroy(): void;
}

export type SceneFactory = (canvas: HTMLCanvasElement, opts: SceneOptions) => SceneHandle;

export interface StreetBootDeps {
  canRun(canvas: HTMLCanvasElement): boolean;
  fontsReady(): Promise<void>;
  loadScene(): Promise<SceneFactory>;
}

export function canRunScene(win: Window, canvas: HTMLCanvasElement): boolean {
  if (typeof win.matchMedia !== 'function') return false;
  if (typeof (win as Window & typeof globalThis).IntersectionObserver !== 'function') return false;
  return canvas.getContext('2d') !== null;
}

export function browserDeps(): StreetBootDeps {
  return {
    canRun: (canvas) => canRunScene(window, canvas),
    fontsReady: () => fontsReady(document.fonts),
    loadScene: () => import('./scene').then((m) => (canvas, opts) => new m.Scene(canvas, opts)),
  };
}

export async function bootStreet(
  canvas: HTMLCanvasElement,
  opts: SceneOptions,
  deps: StreetBootDeps,
  alive: () => boolean,
): Promise<SceneHandle | null> {
  if (!deps.canRun(canvas)) return null;
  await deps.fontsReady();
  if (!alive()) return null;
  const factory = await deps.loadScene().catch(() => null);
  if (!factory) return null;
  if (!alive()) return null;
  try {
    return factory(canvas, opts);
  } catch {
    return null;
  }
}
