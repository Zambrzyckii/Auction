export const MAX_SKY_ROWS = 14;

const MIN_COLS = 360;
const WIDTH_SCALES = [4, 3, 2];

export interface FitInput {
  viewportWidth: number;
  heightBudget: number;
  dpr: number;
  rows: number;
  worldCols: number;
}

export interface StreetFit {
  scale: number;
  skyRows: number;
}

export function widthScale(viewportWidth: number): number {
  return WIDTH_SCALES.find((scale) => viewportWidth / scale >= MIN_COLS) ?? 2;
}

export function deviceScale(scale: number, dpr: number): number {
  return Math.max(1, Math.round(scale * dpr));
}

function cssPixel(scale: number, dpr: number): number {
  return deviceScale(scale, dpr) / dpr;
}

export function streetFit(input: FitInput): StreetFit {
  const { viewportWidth, heightBudget, dpr, rows, worldCols } = input;
  const widest = widthScale(viewportWidth);
  const candidates = WIDTH_SCALES.filter(
    (scale) =>
      scale === widest || (scale < widest && worldCols * cssPixel(scale, dpr) >= viewportWidth),
  );
  let last: StreetFit = { scale: widest, skyRows: MAX_SKY_ROWS };
  for (const scale of candidates) {
    const skyRows = Math.max(0, Math.ceil(rows - heightBudget / cssPixel(scale, dpr)));
    if (skyRows <= MAX_SKY_ROWS) return { scale, skyRows };
    last = { scale, skyRows: MAX_SKY_ROWS };
  }
  return last;
}
