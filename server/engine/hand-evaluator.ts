import type { Card, HandEvaluation, HandRank } from './types.js';

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const HAND_RANK_VALUES: Record<HandRank, number> = {
  'high_card': 1,
  'one_pair': 2,
  'two_pair': 3,
  'three_of_a_kind': 4,
  'straight': 5,
  'flush': 6,
  'full_house': 7,
  'four_of_a_kind': 8,
  'straight_flush': 9,
  'royal_flush': 10,
};

/**
 * Generate all C(n, k) combinations from an array.
 */
function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function helper(start: number, chosen: T[]) {
    if (chosen.length === k) {
      result.push([...chosen]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      chosen.push(arr[i]);
      helper(i + 1, chosen);
      chosen.pop();
    }
  }
  helper(0, []);
  return result;
}

/**
 * Evaluate exactly 5 cards and return a HandEvaluation.
 */
function evaluate5(cards: Card[]): HandEvaluation {
  const values = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check for straight
  let isStraight = false;
  let straightHighValue = 0;

  // Normal straight check
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  if (uniqueValues.length === 5) {
    if (uniqueValues[0] - uniqueValues[4] === 4) {
      isStraight = true;
      straightHighValue = uniqueValues[0];
    }
    // Ace-low straight: A-2-3-4-5
    if (uniqueValues[0] === 14 && uniqueValues[1] === 5 && uniqueValues[2] === 4 && uniqueValues[3] === 3 && uniqueValues[4] === 2) {
      isStraight = true;
      straightHighValue = 5; // 5-high straight
    }
  }

  // Count ranks
  const rankCounts: Map<number, number> = new Map();
  for (const v of values) {
    rankCounts.set(v, (rankCounts.get(v) || 0) + 1);
  }

  // Sort groups by count desc, then by value desc
  const groups = Array.from(rankCounts.entries())
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  // Determine hand rank
  let rank: HandRank;
  let rankValue: number;
  let tiebreakers: number[];
  let description: string;

  if (isStraight && isFlush && straightHighValue === 14) {
    rank = 'royal_flush';
    rankValue = 10;
    tiebreakers = [14];
    description = 'Royal Flush';
  } else if (isStraight && isFlush) {
    rank = 'straight_flush';
    rankValue = 9;
    tiebreakers = [straightHighValue];
    description = `Straight Flush, ${rankName(straightHighValue)} high`;
  } else if (groups[0][1] === 4) {
    rank = 'four_of_a_kind';
    rankValue = 8;
    const quadVal = groups[0][0];
    const kicker = groups[1][0];
    tiebreakers = [quadVal, kicker];
    description = `Four of a Kind, ${rankName(quadVal)}s`;
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    rank = 'full_house';
    rankValue = 7;
    tiebreakers = [groups[0][0], groups[1][0]];
    description = `Full House, ${rankName(groups[0][0])}s full of ${rankName(groups[1][0])}s`;
  } else if (isFlush) {
    rank = 'flush';
    rankValue = 6;
    tiebreakers = values;
    description = `Flush, ${rankName(values[0])} high`;
  } else if (isStraight) {
    rank = 'straight';
    rankValue = 5;
    tiebreakers = [straightHighValue];
    description = `Straight, ${rankName(straightHighValue)} high`;
  } else if (groups[0][1] === 3) {
    rank = 'three_of_a_kind';
    rankValue = 4;
    const tripVal = groups[0][0];
    const kickers = groups.slice(1).map(g => g[0]).sort((a, b) => b - a);
    tiebreakers = [tripVal, ...kickers];
    description = `Three of a Kind, ${rankName(tripVal)}s`;
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    rank = 'two_pair';
    rankValue = 3;
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups[2][0];
    tiebreakers = [highPair, lowPair, kicker];
    description = `Two Pair, ${rankName(highPair)}s and ${rankName(lowPair)}s`;
  } else if (groups[0][1] === 2) {
    rank = 'one_pair';
    rankValue = 2;
    const pairVal = groups[0][0];
    const kickers = groups.slice(1).map(g => g[0]).sort((a, b) => b - a);
    tiebreakers = [pairVal, ...kickers];
    description = `One Pair, ${rankName(pairVal)}s`;
  } else {
    rank = 'high_card';
    rankValue = 1;
    tiebreakers = values;
    description = `High Card, ${rankName(values[0])}`;
  }

  return {
    rank,
    rankValue,
    tiebreakers,
    description,
    bestCards: [...cards],
  };
}

function rankName(value: number): string {
  switch (value) {
    case 14: return 'Ace';
    case 13: return 'King';
    case 12: return 'Queen';
    case 11: return 'Jack';
    default: return String(value);
  }
}

/**
 * Evaluate the best 5-card hand from 5, 6, or 7 cards.
 * Uses brute-force C(n, 5) combinations.
 */
export function evaluateHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`evaluateHand requires 5-7 cards, got ${cards.length}`);
  }

  if (cards.length === 5) {
    return evaluate5(cards);
  }

  const combos = combinations(cards, 5);
  let best: HandEvaluation | null = null;

  for (const combo of combos) {
    const evaluation = evaluate5(combo);
    if (best === null || compareHands(evaluation, best) > 0) {
      best = evaluation;
    }
  }

  return best!;
}

/**
 * Compare two hand evaluations.
 * Returns positive if `a` wins, negative if `b` wins, 0 for tie.
 */
export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rankValue !== b.rankValue) {
    return a.rankValue - b.rankValue;
  }

  // Compare tiebreakers in order
  const len = Math.min(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    if (a.tiebreakers[i] !== b.tiebreakers[i]) {
      return a.tiebreakers[i] - b.tiebreakers[i];
    }
  }

  return 0;
}
