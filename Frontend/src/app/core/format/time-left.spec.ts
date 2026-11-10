import { timeLeft } from './time-left';

describe('timeLeft', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');

  it('formats under an hour as minutes and seconds', () => {
    expect(timeLeft('2026-11-10T12:04:30Z', now)).toBe('4 min 30 s');
  });

  it('formats an hour and more as hours and minutes', () => {
    expect(timeLeft('2026-11-10T14:05:00Z', now)).toBe('2 h 5 min');
  });

  it('says ending for a past timestamp', () => {
    expect(timeLeft('2026-11-10T11:59:00Z', now)).toBe('ending…');
  });

  it('returns an empty string for garbage input', () => {
    expect(timeLeft('not-a-date', now)).toBe('');
  });
});
