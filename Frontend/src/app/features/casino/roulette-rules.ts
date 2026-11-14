import {
  Casino as CasinoDto,
  RouletteBet,
  RouletteBetType,
  RouletteLimits,
} from '../../core/api/models';

export const ROULETTE_BET_TYPES: readonly RouletteBetType[] = [
  'Straight',
  'Red',
  'Black',
  'Odd',
  'Even',
  'Low',
  'High',
  'Dozen',
  'Column',
];

function hasValidSelection({ type, selection }: RouletteBet): boolean {
  switch (type) {
    case 'Straight':
      return selection !== null && Number.isInteger(selection) && selection >= 0 && selection <= 36;
    case 'Dozen':
    case 'Column':
      return selection !== null && Number.isInteger(selection) && selection >= 1 && selection <= 3;
    default:
      return selection === null;
  }
}

export function betProblem(bet: RouletteBet, limits: RouletteLimits): string | null {
  if (!hasValidSelection(bet)) {
    return 'Bet selection does not match its type';
  }
  if (!Number.isInteger(bet.stake) || bet.stake < limits.minBet || bet.stake > limits.maxBet) {
    return 'Each stake must be a whole number of chips within the table limits';
  }
  return null;
}

export function spinProblem(bets: readonly RouletteBet[], casino: CasinoDto): string | null {
  const max = casino.roulette.maxBetsPerSpin;
  if (bets.length < 1 || bets.length > max) {
    return `A spin takes between 1 and ${max} bets`;
  }
  const total = bets.reduce((sum, bet) => sum + bet.stake, 0);
  if (total > casino.balance) return 'Not enough chips on account';
  return null;
}
