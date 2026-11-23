import type { Mock } from 'vitest';
import { ASK_WINDOW_MS, BankStage, STAGE_WATCHDOG_MS } from './bank-stage';
import type { BankStageRoom } from './bank-stage';
import type { BankLoan, BankShown, BankStep, WireRow } from './bank-watch';

const loan = (over: Partial<BankLoan> = {}): BankLoan => ({
  publicLoanId: 'l1',
  principal: 200,
  totalDue: 220,
  penalty: 0,
  amountRepaid: 0,
  outstanding: 220,
  status: 'Active',
  dueOn: '2026-11-23T12:30:00Z',
  overdueSince: null,
  rejectionReason: null,
  ...over,
});

const pending = (): BankLoan => loan({ status: 'PendingApproval' });
const overdue = (over: Partial<BankLoan> = {}): BankLoan =>
  loan({ status: 'Overdue', overdueSince: '2026-11-23T12:31:00Z', penalty: 44, ...over });
const collecting = (over: Partial<BankLoan> = {}): BankLoan =>
  loan({ status: 'CollectionPending', ...over });

const ME = 'me';
const row = (sentOn: string, out: boolean, amount = 50): WireRow => ({
  senderUserId: out ? ME : 'other',
  recipientUserId: out ? 'other' : ME,
  amount,
  sentOn,
});

const kinds = (steps: readonly BankStep[]) => steps.map((s) => s.kind);

describe('BankStage', () => {
  let calls: string[];
  let room: {
    run: Mock<(steps: readonly BankStep[]) => void>;
    place: Mock<(shown: BankShown) => void>;
  };
  let onStaging: Mock<(on: boolean) => void>;
  let stage: BankStage;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
    calls = [];
    room = {
      run: vi.fn(() => {
        calls.push('run');
      }),
      place: vi.fn(() => {
        calls.push('place');
      }),
    };
    onStaging = vi.fn((on: boolean) => {
      calls.push(on ? 'staging-on' : 'staging-off');
    });
    stage = new BankStage(onStaging);
  });

  afterEach(() => {
    stage.stop();
    vi.useRealTimers();
  });

  const attach = (reduced = false): void => stage.attach(room satisfies BankStageRoom, reduced);
  const lastRun = (): readonly BankStep[] => room.run.mock.calls.at(-1)![0];

  describe('loans', () => {
    it('does nothing for loans seen before attach', () => {
      stage.seeLoans([loan()], true);
      expect(room.run).not.toHaveBeenCalled();
      expect(room.place).not.toHaveBeenCalled();
      expect(onStaging).not.toHaveBeenCalled();
    });

    it('places the newest recorded loan as known with no slips at attach', () => {
      const newest = loan({ publicLoanId: 'new' });
      stage.seeLoans([newest, loan({ publicLoanId: 'old', status: 'Repaid' })], true);
      attach();
      expect(room.place).toHaveBeenCalledWith({ loan: newest, known: true, slips: [] });
      expect(room.run).not.toHaveBeenCalled();
    });

    it('places an unknown empty room when nothing was seen', () => {
      attach();
      expect(room.place).toHaveBeenCalledWith({ loan: null, known: false, slips: [] });
    });

    it('takes the first loans after attach as an unstaged baseline', () => {
      attach();
      stage.seeLoans(null, true);
      expect(room.run).not.toHaveBeenCalled();
      const first = loan();
      stage.seeLoans([first], true);
      expect(room.run).toHaveBeenCalledTimes(1);
      expect(lastRun()).toEqual([{ kind: 'snapLoan', loan: first }]);
      expect(onStaging).not.toHaveBeenCalledWith(true);
    });

    it('takes an empty first list as a baseline too', () => {
      attach();
      stage.seeLoans([], true);
      expect(lastRun()).toEqual([{ kind: 'snapLoan', loan: null }]);
      stage.seeLoans([pending()], true);
      expect(kinds(lastRun())).toEqual(['requested']);
    });

    it('turns staging on before the room runs an approval', () => {
      stage.seeLoans([pending()], true);
      attach();
      stage.seeLoans([loan()], true);
      expect(calls).toEqual(['place', 'staging-on', 'run']);
      expect(kinds(lastRun())).toEqual(['approved']);
    });

    it('turns staging off at the first reveal of a lone outcome', () => {
      stage.seeLoans([pending()], true);
      attach();
      stage.seeLoans([loan()], true);
      stage.revealed();
      expect(onStaging).toHaveBeenLastCalledWith(false);
    });

    it('keeps staging until the last staged step has revealed', () => {
      stage.seeLoans([loan()], true);
      attach();
      stage.seeLoans([overdue()], true);
      expect(kinds(lastRun())).toEqual(['collecting', 'overdue']);
      expect(onStaging).toHaveBeenCalledWith(true);
      stage.revealed();
      expect(onStaging).not.toHaveBeenCalledWith(false);
      stage.revealed();
      expect(onStaging).toHaveBeenLastCalledWith(false);
    });

    it('never stages a lone requested step', () => {
      attach();
      stage.seeLoans([], true);
      stage.seeLoans([pending()], true);
      expect(kinds(lastRun())).toEqual(['requested']);
      expect(onStaging).not.toHaveBeenCalledWith(true);
    });

    it('never stages when the scene is not visible', () => {
      stage.seeLoans([pending()], false);
      attach();
      stage.seeLoans([loan()], false);
      expect(room.run).toHaveBeenCalledTimes(1);
      expect(onStaging).not.toHaveBeenCalledWith(true);
    });

    it('never stages under reduced motion', () => {
      stage.seeLoans([pending()], true);
      attach(true);
      stage.seeLoans([loan()], true);
      expect(room.run).toHaveBeenCalledTimes(1);
      expect(onStaging).not.toHaveBeenCalledWith(true);
    });

    it('ends staging when the watchdog fires', () => {
      stage.seeLoans([pending()], true);
      attach();
      stage.seeLoans([loan()], true);
      vi.advanceTimersByTime(STAGE_WATCHDOG_MS);
      expect(onStaging).toHaveBeenLastCalledWith(false);
    });

    it('restarts the watchdog on every staged run', () => {
      stage.seeLoans([pending()], true);
      attach();
      stage.seeLoans([loan()], true);
      vi.advanceTimersByTime(6000);
      stage.seeLoans([overdue()], true);
      vi.advanceTimersByTime(6000);
      expect(onStaging).not.toHaveBeenCalledWith(false);
      vi.advanceTimersByTime(6000);
      expect(onStaging).toHaveBeenLastCalledWith(false);
    });

    it('does not turn staging on again from a reveal after hidden', () => {
      stage.seeLoans([pending()], true);
      attach();
      stage.seeLoans([loan()], true);
      stage.hidden();
      onStaging.mockClear();
      stage.revealed();
      expect(onStaging).not.toHaveBeenCalledWith(true);
    });

    it('still ends a staged run after hidden at its own reveal', () => {
      stage.seeLoans([loan()], true);
      attach();
      stage.seeLoans([overdue()], true);
      stage.hidden();
      stage.seeLoans([overdue({ amountRepaid: 5 })], true);
      expect(kinds(lastRun())).toEqual(['collecting', 'overdue']);
      stage.revealed();
      stage.revealed();
      stage.revealed();
      expect(onStaging).toHaveBeenLastCalledWith(true);
      stage.revealed();
      expect(onStaging).toHaveBeenLastCalledWith(false);
    });

    it('turns staging off on idle', () => {
      stage.seeLoans([pending()], true);
      attach();
      stage.seeLoans([loan()], true);
      stage.idle();
      expect(onStaging).toHaveBeenLastCalledWith(false);
    });

    it('ends with staging off when the room reveals synchronously', () => {
      room.run.mockImplementation(() => {
        stage.revealed();
      });
      stage.seeLoans([pending()], true);
      attach();
      stage.seeLoans([loan()], true);
      expect(calls).toEqual(['place', 'staging-on', 'staging-off']);
    });

    it('clears a pending watchdog on stop', () => {
      stage.seeLoans([pending()], true);
      attach();
      stage.seeLoans([loan()], true);
      onStaging.mockClear();
      stage.stop();
      vi.advanceTimersByTime(STAGE_WATCHDOG_MS * 2);
      expect(onStaging).not.toHaveBeenCalled();
    });

    it('credits a collection to the player within the ask window', () => {
      stage.seeLoans([overdue()], true);
      attach();
      stage.ask(true);
      vi.advanceTimersByTime(ASK_WINDOW_MS - 1000);
      stage.seeLoans([collecting({ overdueSince: overdue().overdueSince })], true);
      expect(lastRun()).toEqual([
        expect.objectContaining({ kind: 'collecting', by: 'player', paid: null }),
      ]);
    });

    it('credits a collection to the retry after the ask window', () => {
      stage.seeLoans([overdue()], true);
      attach();
      stage.ask(true);
      vi.advanceTimersByTime(ASK_WINDOW_MS + 1000);
      stage.seeLoans([collecting({ overdueSince: overdue().overdueSince })], true);
      expect(lastRun()).toEqual([expect.objectContaining({ kind: 'collecting', by: 'retry' })]);
    });

    it('forgets the ask once a collection used it', () => {
      stage.seeLoans([overdue()], true);
      attach();
      stage.ask(true);
      stage.seeLoans([collecting({ overdueSince: overdue().overdueSince })], true);
      stage.seeLoans([overdue({ amountRepaid: 0 })], true);
      stage.seeLoans([collecting({ overdueSince: overdue().overdueSince })], true);
      expect(lastRun()).toEqual([expect.objectContaining({ kind: 'collecting', by: 'retry' })]);
    });

    it('runs once when the same loans are seen twice', () => {
      stage.seeLoans([pending()], true);
      attach();
      stage.seeLoans([loan()], true);
      stage.seeLoans([loan()], true);
      expect(room.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('wires', () => {
    it('places the slips of the rows recorded before attach', () => {
      const rows = [row('2026-11-23T11:00:00Z', true, 70), row('2026-11-23T10:00:00Z', false, 30)];
      stage.seeWires(rows, ME, true);
      attach();
      expect(room.place).toHaveBeenCalledWith({
        loan: null,
        known: false,
        slips: [
          { out: true, amount: 70 },
          { out: false, amount: 30 },
        ],
      });
    });

    it('stages a new outgoing row', () => {
      const old = row('2026-11-23T10:00:00Z', false);
      stage.seeWires([old], ME, true);
      attach();
      const sent = row('2026-11-23T11:00:00Z', true, 50);
      stage.seeWires([sent, old], ME, true);
      expect(lastRun()).toEqual([
        {
          kind: 'wireOut',
          amount: 50,
          slips: [
            { out: true, amount: 50 },
            { out: false, amount: 50 },
          ],
        },
      ]);
      expect(calls).toEqual(['place', 'staging-on', 'run']);
    });

    it('takes the first rows after an attach without rows as an unstaged baseline', () => {
      attach();
      stage.seeWires(null, ME, true);
      expect(room.run).not.toHaveBeenCalled();
      stage.seeWires([row('2026-11-23T10:00:00Z', true, 20)], ME, true);
      expect(lastRun()).toEqual([{ kind: 'snapSlips', slips: [{ out: true, amount: 20 }] }]);
      expect(onStaging).not.toHaveBeenCalledWith(true);
    });

    it('runs nothing while me is null', () => {
      attach();
      stage.seeWires([row('2026-11-23T10:00:00Z', true)], null, true);
      expect(room.run).not.toHaveBeenCalled();
    });

    it('runs once when the same rows are seen twice', () => {
      const old = row('2026-11-23T10:00:00Z', false);
      stage.seeWires([old], ME, true);
      attach();
      const sent = row('2026-11-23T11:00:00Z', true);
      stage.seeWires([sent, old], ME, true);
      stage.seeWires([sent, old], ME, true);
      expect(room.run).toHaveBeenCalledTimes(1);
    });
  });
});
