import { deviceScale, streetFit, StreetFit, widthScale } from './street-fit';

function fit(viewportWidth: number, heightBudget: number, dpr: number): StreetFit {
  return streetFit({ viewportWidth, heightBudget, dpr, rows: 180, worldCols: 640 });
}

describe('widthScale', () => {
  it('picks the largest scale that keeps 360 columns', () => {
    expect([1920, 1440, 1439, 1080, 1079, 760, 400, 320].map(widthScale)).toEqual([
      4, 4, 3, 3, 2, 2, 2, 2,
    ]);
  });
});

describe('deviceScale', () => {
  it('rounds the scale to whole device pixels', () => {
    expect(deviceScale(4, 1)).toBe(4);
    expect(deviceScale(3, 1.1)).toBe(3);
    expect(deviceScale(3, 1.25)).toBe(4);
    expect(deviceScale(2, 1.25)).toBe(3);
    expect(deviceScale(2, 3)).toBe(6);
    expect(deviceScale(1, 0.4)).toBe(1);
  });
});

describe('streetFit', () => {
  it('cuts sky rows at the width scale when that is enough', () => {
    expect(fit(1906, 680, 1)).toEqual({ scale: 4, skyRows: 10 });
    expect(fit(1920, 716, 1)).toEqual({ scale: 4, skyRows: 1 });
    expect(fit(2560, 1068, 1)).toEqual({ scale: 4, skyRows: 0 });
  });

  it('drops a scale when the cut would reach the billboard', () => {
    expect(fit(1440, 552, 1)).toEqual({ scale: 3, skyRows: 0 });
    expect(fit(1280, 483, 1)).toEqual({ scale: 2, skyRows: 0 });
  });

  it('never takes a scale that leaves side bands', () => {
    expect(fit(1366, 420, 1)).toEqual({ scale: 3, skyRows: 14 });
    expect(fit(1906, 100, 1)).toEqual({ scale: 3, skyRows: 14 });
  });

  it('sizes rows in device pixels at a fractional dpr', () => {
    expect(fit(1536, 493, 1.25)).toEqual({ scale: 2, skyRows: 0 });
    expect(fit(390, 494, 3)).toEqual({ scale: 2, skyRows: 0 });
  });
});
