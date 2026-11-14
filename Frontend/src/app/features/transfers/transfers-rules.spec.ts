import { Wallet } from '../../core/api/models';
import { transferProblem } from './transfers-rules';

const MY_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const OTHER_ID = 'deadbeef-1111-2222-3333-444444444444';

describe('transferProblem', () => {
  const funds: Wallet = { availableFunds: 100, lockedFunds: 0, lifetimeTurnover: 0 };

  it('accepts a valid transfer', () => {
    expect(transferProblem(25.5, OTHER_ID, MY_ID, funds)).toBeNull();
  });

  it('rejects a non-positive amount', () => {
    expect(transferProblem(0, OTHER_ID, MY_ID, funds)).toMatch(/above zero/);
    expect(transferProblem(-5, OTHER_ID, MY_ID, funds)).toMatch(/above zero/);
  });

  it('rejects more than two decimal places', () => {
    expect(transferProblem(0.001, OTHER_ID, MY_ID, funds)).toMatch(/decimal/);
  });

  it('rejects myself with the validator text', () => {
    expect(transferProblem(10, MY_ID, MY_ID, funds)).toBe('Cannot transfer funds to yourself');
  });

  it('rejects more than the available funds', () => {
    expect(transferProblem(100.01, OTHER_ID, MY_ID, funds)).toBe('Not enough funds on account');
  });
});
