import type { FontKey } from './pix';
import { R, Sprite, measure, text } from './pix';

export interface HudState {
  readonly name: string;
  readonly cash: number;
  readonly level: number;
  readonly share: number;
  readonly nextAt: number;
}

const PAPER_H = 40;
const BAR_H = 9;
const KICK_Y = 3;
const CASH_Y = 11;

const money = (n: number): string => Math.round(n).toLocaleString('en-US');

const kickLine = (name: string, level: number): string => `${name} - LV ${level}`;

export function fitName(name: string, level: number, maxWidth: number): string {
  let fitted = name.trim().toUpperCase();
  while (fitted.length > 1 && measure(kickLine(fitted, level)) > maxWidth) {
    fitted = fitted.slice(0, -1).trimEnd();
  }
  return fitted;
}

const centered = (width: number, str: string, font?: FontKey): number =>
  Math.floor((width - measure(str, font)) / 2);

const cashInk = (_x: number, y: number): string => (y < 2 ? R.red[3] : R.red[2]);

export function hudPaper(
  state: HudState,
  shownCash: number,
  shownShare: number,
  width: number,
): Sprite {
  const paper = new Sprite(width, PAPER_H);
  paper.rect(0, 0, width, PAPER_H, R.paper[3]);

  const kick = kickLine(fitName(state.name, state.level, width - 2), state.level);
  text(paper, kick, centered(width, kick), KICK_Y, R.black[3], 'tiny', { alignTop: true });

  const cash = '$' + money(shownCash);
  text(paper, cash, centered(width, cash, 'jersey'), CASH_Y, cashInk, 'jersey', {
    alignTop: true,
    shadow: R.paper[1],
  });

  const barY = PAPER_H - BAR_H;
  paper.rect(0, barY, width, BAR_H, R.black[1]);
  const fill = Math.max(0, Math.min(width, Math.round(width * shownShare)));
  if (fill > 0) {
    paper.rect(0, barY, fill, BAR_H, R.green[2]);
    paper.hline(0, barY, fill, R.green[3]);
  }
  const tag = `LV ${state.level + 1} AT $${money(state.nextAt)}`;
  text(paper, tag, centered(width, tag), barY + 1, R.paper[3], 'tiny', { alignTop: true });
  return paper;
}

export function hudKey(state: HudState, shownCash: number, shownShare: number): string {
  return [
    state.name,
    Math.round(shownCash),
    state.level,
    Math.round(shownShare * 200),
    state.nextAt,
  ].join('|');
}
