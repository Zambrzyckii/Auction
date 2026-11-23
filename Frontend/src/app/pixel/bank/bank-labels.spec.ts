import type * as Labels from './bank-labels';
import type { BankLoan, BankOffer } from './bank-watch';

const looseContext = () => {
  const target: Record<string | symbol, unknown> = {
    measureText: () => ({ width: 0 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(255),
      width: w,
      height: h,
    }),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
  };
  return new Proxy(target, {
    get: (t, prop) => (prop in t ? t[prop] : () => undefined),
    set: (t, prop, value) => {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
};

const NOW = Date.parse('2026-11-23T12:00:00Z');

const loan = (over: Partial<BankLoan> = {}): BankLoan => ({
  publicLoanId: 'l1',
  principal: 200,
  totalDue: 220,
  penalty: 0,
  amountRepaid: 0,
  outstanding: 220,
  status: 'Active',
  dueOn: '2026-11-23T12:01:00Z',
  overdueSince: null,
  rejectionReason: null,
  ...over,
});

const OFFERS: readonly BankOffer[] = [
  { name: 'Quick', principal: 200, totalDue: 220, term: '00:01:00', requiredTurnover: 400 },
  { name: 'Standard', principal: 1000, totalDue: 1150, term: '00:10:00', requiredTurnover: 2000 },
  { name: 'Long', principal: 5000, totalDue: 6250, term: '00:30:00', requiredTurnover: 10000 },
];

describe('bank labels', () => {
  let labels: typeof Labels;

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    labels = await import('./bank-labels');
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('ledRows', () => {
    const rows = (l: BankLoan | null, known = true) => labels.ledRows(l, known, NOW, null);

    it('shows only NEXT! while loans are not known', () => {
      expect(rows(null, false)).toEqual(['', 'NEXT!', '']);
    });

    it('shows NO LOAN without a loan', () => {
      expect(rows(null)).toEqual(['NO LOAN', 'NEXT!', '']);
    });

    it('shows IN REVIEW for a pending loan', () => {
      expect(rows(loan({ status: 'PendingApproval' }))).toEqual(['IN REVIEW', 'LOAN $200', '']);
    });

    it('shows DUE IN with an empty middle row without a format', () => {
      expect(rows(loan({ outstanding: 1234.5 }))).toEqual(['DUE IN', '', 'OWED $1,234.5']);
    });

    it('formats the due time with the format and now', () => {
      const format = vi.fn(() => 'ending…');
      const l = loan();
      expect(labels.ledRows(l, true, NOW, format)).toEqual(['DUE IN', 'ENDING...', 'OWED $220']);
      expect(format).toHaveBeenCalledWith(l.dueOn, NOW);
    });

    it('shows COLLECTING for a pending collection', () => {
      expect(rows(loan({ status: 'CollectionPending' }))).toEqual(['COLLECTING', '', 'OWED $220']);
    });

    it('shows OVERDUE with the fee', () => {
      expect(rows(loan({ status: 'Overdue', penalty: 44, outstanding: 264 }))).toEqual([
        'OVERDUE',
        'FEE $44',
        'OWED $264',
      ]);
    });

    it('shows PAID IN FULL with what was repaid', () => {
      expect(rows(loan({ status: 'Repaid', amountRepaid: 220, outstanding: 0 }))).toEqual([
        'PAID IN FULL',
        'PAID $220',
        'OWED $0',
      ]);
    });

    it('shows DENIED for a rejected loan', () => {
      expect(rows(loan({ status: 'Rejected' }))).toEqual(['DENIED', 'NEXT!', '']);
    });
  });

  describe('boardRows and boardLine', () => {
    it('leaves Quick open and locks Standard and Long at turnover 650', () => {
      const rows = labels.boardRows(OFFERS, 650);
      expect(rows.map((r) => r.locked)).toEqual([false, true, true]);
      expect(rows.map((r) => r.tag)).toEqual([null, '2,000+', '10,000+']);
      expect(rows.map(labels.boardLine)).toEqual([
        'QUICK $200 $220 1 MIN',
        'STANDARD $1,000 $1,150 10 MIN 2,000+',
        'LONG $5,000 $6,250 30 MIN 10,000+',
      ]);
    });

    it('locks nothing when the turnover is unknown', () => {
      const rows = labels.boardRows(OFFERS, null);
      expect(rows.map((r) => r.locked)).toEqual([false, false, false]);
      expect(rows.map((r) => r.tag)).toEqual([null, null, null]);
    });

    it('takes only the first three offers', () => {
      const four = [...OFFERS, { ...OFFERS[0], name: 'Extra' }];
      expect(labels.boardRows(four, 0)).toHaveLength(3);
    });

    it('pins the late fee sign', () => {
      expect(labels.BOARD_FEE).toBe('LATE FEE 20%');
    });
  });

  describe('neonLines', () => {
    it('gives the facade lines', () => {
      expect(labels.neonLines(OFFERS)).toEqual(['QUICK $200', 'STD $1,000', 'LONG $5,000']);
    });
  });

  describe('termLabel', () => {
    it.each([
      ['00:01:00', '1 MIN'],
      ['00:30:00', '30 MIN'],
      ['01:30:00', '90 MIN'],
      ['1.00:00:00', '1440 MIN'],
    ])('reads %s as %s', (term, label) => {
      expect(labels.termLabel(term)).toBe(label);
    });

    it.each(['00:00:30', 'soon'])('returns %s unchanged', (term) => {
      expect(labels.termLabel(term)).toBe(term);
    });
  });

  describe('slipLabel', () => {
    it('signs and formats the amount', () => {
      expect(labels.slipLabel({ out: true, amount: 40 })).toBe('-40');
      expect(labels.slipLabel({ out: false, amount: 120.5 })).toBe('+120.5');
      expect(labels.slipLabel({ out: false, amount: 1262.5 })).toBe('+1,262.5');
    });
  });
});
