import { AuctionBid } from '../../core/api/models';
import { endsOnUtc, isBidConfirmed } from './auction-rules';

const MY_ID = 'me-user';

function bid(overrides: Partial<AuctionBid>): AuctionBid {
  return {
    bidderUserId: 'cafebabe-0000-0000-0000-000000000000',
    amount: 200,
    placedOn: new Date().toISOString(),
    ...overrides,
  };
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

describe('isBidConfirmed', () => {
  it('confirms when the history holds my id with my amount', () => {
    const history = [bid({ amount: 220 }), bid({ bidderUserId: MY_ID, amount: 200 })];
    expect(isBidConfirmed(history, MY_ID, 200)).toBe(true);
  });

  it('ignores someone else bidding the same amount', () => {
    expect(isBidConfirmed([bid({ amount: 200 })], MY_ID, 200)).toBe(false);
  });

  it('ignores my bids over other amounts', () => {
    expect(isBidConfirmed([bid({ bidderUserId: MY_ID, amount: 180 })], MY_ID, 200)).toBe(false);
  });

  it('never confirms while logged out', () => {
    expect(isBidConfirmed([bid({ bidderUserId: MY_ID, amount: 200 })], null, 200)).toBe(false);
  });
});

describe('endsOnUtc', () => {
  it('treats the input as local time and returns UTC ISO with a Z', () => {
    const inOneHour = new Date(Date.now() + 3_600_000);
    const result = endsOnUtc(toLocalInput(inOneHour));
    expect(result).not.toBeNull();
    expect(result!.endsWith('Z')).toBe(true);
    const roundTrip = new Date(result!).getTime();
    expect(Math.abs(roundTrip - inOneHour.getTime())).toBeLessThan(60_000);
  });

  it('rejects an end sooner than one minute from now', () => {
    expect(endsOnUtc(toLocalInput(new Date(Date.now() + 30_000)))).toBeNull();
    expect(endsOnUtc(toLocalInput(new Date(Date.now() - 3_600_000)))).toBeNull();
  });

  it('rejects an end beyond thirty days', () => {
    expect(endsOnUtc(toLocalInput(new Date(Date.now() + 31 * 24 * 3_600_000)))).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(endsOnUtc('')).toBeNull();
    expect(endsOnUtc('not-a-date')).toBeNull();
  });
});
