import { WarSnap, warLeader, warMove, warPhase } from './war-watch';

const snap = (over: Partial<WarSnap> = {}): WarSnap => ({
  status: 'Bidding',
  isLeader: false,
  currentPrice: 100,
  players: 3,
  ...over,
});

describe('warPhase', () => {
  it('maps the status strings to scene phases', () => {
    expect(warPhase('Open', false)).toBe('open');
    expect(warPhase('Open', true)).toBe('open');
    expect(warPhase('Bidding', true)).toBe('bidding');
    expect(warPhase('Settled', true)).toBe('won');
    expect(warPhase('Settled', false)).toBe('lost');
  });
  it('treats Cancelled and unknown statuses as open', () => {
    expect(warPhase('Cancelled', false)).toBe('open');
    expect(warPhase('Something', true)).toBe('open');
    expect(warPhase('', false)).toBe('open');
  });
});

describe('warLeader', () => {
  it('names you, the rival or nobody', () => {
    expect(warLeader(snap({ isLeader: true }))).toBe('you');
    expect(warLeader(snap({ isLeader: false, currentPrice: 50 }))).toBe('rival');
    expect(warLeader(snap({ isLeader: false, currentPrice: 0 }))).toBeNull();
  });
});

describe('warMove', () => {
  it('stays null on the first snapshot', () => {
    expect(warMove(null, snap())).toBeNull();
    expect(warMove(null, snap({ status: 'Settled', isLeader: true }))).toBeNull();
  });

  it('settles when a poll turns Settled, from Bidding or straight from Open', () => {
    expect(warMove(snap(), snap({ status: 'Settled', isLeader: true }))).toEqual({
      kind: 'settle',
      won: true,
    });
    expect(warMove(snap({ status: 'Open' }), snap({ status: 'Settled', isLeader: false }))).toEqual(
      { kind: 'settle', won: false },
    );
  });

  it('does not settle twice', () => {
    expect(
      warMove(snap({ status: 'Settled' }), snap({ status: 'Settled', currentPrice: 200 })),
    ).toBeNull();
  });

  it('raises on a higher price inside Bidding with the right side and delta', () => {
    expect(warMove(snap(), snap({ currentPrice: 130, isLeader: true }))).toEqual({
      kind: 'raise',
      by: 'you',
      delta: 30,
    });
    expect(warMove(snap(), snap({ currentPrice: 175, isLeader: false }))).toEqual({
      kind: 'raise',
      by: 'rival',
      delta: 75,
    });
  });

  it('stays null on a price drop, an equal price and a non-Bidding step', () => {
    expect(warMove(snap(), snap({ currentPrice: 90 }))).toBeNull();
    expect(warMove(snap(), snap())).toBeNull();
    expect(warMove(snap({ status: 'Open', currentPrice: 0 }), snap({ status: 'Open' }))).toBeNull();
    expect(warMove(snap({ status: 'Open', currentPrice: 0 }), snap())).toBeNull();
  });
});
