import type { BuildingId } from '../../pixel/street/city';
import type { HudState } from '../../pixel/street/hud';
import type { LevelUpFx, StreetEventFx } from '../../pixel/street/scene';

interface TopicRule {
  readonly at: BuildingId;
  readonly up: string;
  readonly down: string;
}

const TOPIC_RULES: Readonly<Record<string, TopicRule>> = {
  AuctionChanged: { at: 'auction', up: 'SOLD', down: 'YOU WON' },
  AuctionListChanged: { at: 'auction', up: 'SOLD', down: 'YOU WON' },
  WarehouseChanged: { at: 'storage', up: 'WAR WON', down: 'WAR ENTRY' },
  CasinoChanged: { at: 'casino', up: 'CASHED OUT', down: 'CHIPS' },
  LoanChanged: { at: 'bank', up: 'LOAN', down: 'PAID BACK' },
  PawnshopChanged: { at: 'pawn', up: 'PAWNSHOP', down: 'PAWNSHOP' },
};

const WIRE_RULE: TopicRule = { at: 'bank', up: 'WIRE IN', down: 'WIRE OUT' };

const SPARKS = 12;
const MAX_COINS = 34;
const MAX_BILLS = 16;
const BILLS_FROM = 1000;
const SPOTLIGHT_FROM = 2000;

export const METER_TOPICS: readonly string[] = Object.keys(TOPIC_RULES);

export type HubFx = ({ kind: 'event' } & StreetEventFx) | ({ kind: 'levelup' } & LevelUpFx);

export function newestTopic(
  seen: ReadonlyMap<string, number>,
  now: number,
  windowMs = 6000,
): string | null {
  let newest: string | null = null;
  let newestAt = -Infinity;
  for (const [topic, seenAt] of seen) {
    if (now - seenAt <= windowMs && seenAt > newestAt) {
      newest = topic;
      newestAt = seenAt;
    }
  }
  return newest;
}

export function rewardBetween(before: number, after: number): number {
  let reward = 0;
  for (let level = before + 1; level <= after; level++) reward += 10 * level * level;
  return reward;
}

function levelUpFx(prev: HudState, next: HudState): HubFx {
  return {
    kind: 'levelup',
    from: prev,
    hud: next,
    reward: rewardBetween(prev.level, next.level),
    rain: 16 + 2 * next.level,
    crowdStop: Math.min(4, next.level),
  };
}

function eventFx(delta: number, topic: string | null): HubFx {
  const rule = (topic === null ? undefined : TOPIC_RULES[topic]) ?? WIRE_RULE;
  const gain = delta > 0;
  const size = Math.abs(delta);
  return {
    kind: 'event',
    at: rule.at,
    word: gain ? rule.up : rule.down,
    amount: delta,
    part: gain ? 'coin' : 'spark',
    coins: gain ? Math.round(Math.min(MAX_COINS, 10 + size / 400)) : SPARKS,
    bills: gain && size >= BILLS_FROM ? Math.round(Math.min(MAX_BILLS, size / 800)) : 0,
    spotlight: size >= SPOTLIGHT_FROM,
  };
}

export function buildFx(prev: HudState, next: HudState, topic: string | null): HubFx | null {
  if (next.level > prev.level) return levelUpFx(prev, next);
  if (next.cash !== prev.cash) return eventFx(next.cash - prev.cash, topic);
  return null;
}
