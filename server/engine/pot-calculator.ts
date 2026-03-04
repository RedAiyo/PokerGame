import type { GamePlayer, SidePot } from './types.js';

export interface PotResult {
  mainPot: number;
  sidePots: SidePot[];
}

/**
 * Calculate main pot and side pots based on player bets and all-in amounts.
 *
 * Algorithm:
 * 1. Sort all-in players by their bet amounts (ascending).
 * 2. For each all-in threshold, create a pot that all players at or above
 *    that threshold are eligible for.
 * 3. Any remaining bets from non-all-in active players go into the final pot.
 */
export function calculatePots(players: GamePlayer[]): PotResult {
  // Only consider players who have bet something
  const bettingPlayers = players.filter(p => p.currentBet > 0);

  if (bettingPlayers.length === 0) {
    return { mainPot: 0, sidePots: [] };
  }

  // Check if any player is all-in
  const allInPlayers = bettingPlayers
    .filter(p => p.status === 'all_in')
    .sort((a, b) => a.currentBet - b.currentBet);

  // If no all-in players, everything goes into the main pot
  if (allInPlayers.length === 0) {
    const totalPot = bettingPlayers.reduce((sum, p) => sum + p.currentBet, 0);
    const eligibleIds = bettingPlayers
      .filter(p => p.status !== 'folded')
      .map(p => p.userId);
    return {
      mainPot: totalPot,
      sidePots: eligibleIds.length > 0
        ? [{ amount: totalPot, eligiblePlayerIds: eligibleIds }]
        : [],
    };
  }

  // Build pots layer by layer using all-in thresholds
  const pots: SidePot[] = [];
  let previousThreshold = 0;

  // Collect unique all-in bet levels
  const thresholds = [...new Set(allInPlayers.map(p => p.currentBet))].sort((a, b) => a - b);

  // Track remaining bets for each player
  const remainingBets = new Map<string, number>();
  for (const p of bettingPlayers) {
    remainingBets.set(p.userId, p.currentBet);
  }

  // Non-folded players for eligibility
  const nonFoldedPlayers = bettingPlayers.filter(p => p.status !== 'folded');

  for (const threshold of thresholds) {
    const layerSize = threshold - previousThreshold;
    if (layerSize <= 0) continue;

    let potAmount = 0;
    const eligibleIds: string[] = [];

    for (const p of bettingPlayers) {
      const remaining = remainingBets.get(p.userId)!;
      const contribution = Math.min(remaining, layerSize);
      potAmount += contribution;
      remainingBets.set(p.userId, remaining - contribution);

      // Player is eligible if not folded and their original bet >= this threshold
      if (p.status !== 'folded' && p.currentBet >= threshold) {
        eligibleIds.push(p.userId);
      }
    }

    if (potAmount > 0) {
      pots.push({ amount: potAmount, eligiblePlayerIds: eligibleIds });
    }

    previousThreshold = threshold;
  }

  // Remaining bets (from players who bet more than the highest all-in)
  let remainingPot = 0;
  const remainingEligible: string[] = [];

  for (const p of bettingPlayers) {
    const remaining = remainingBets.get(p.userId)!;
    if (remaining > 0) {
      remainingPot += remaining;
      remainingBets.set(p.userId, 0);
    }
    // Eligible if not folded and still had remaining bets or bet above max all-in
    if (p.status !== 'folded' && p.currentBet > thresholds[thresholds.length - 1]) {
      remainingEligible.push(p.userId);
    }
  }

  if (remainingPot > 0 && remainingEligible.length > 0) {
    pots.push({ amount: remainingPot, eligiblePlayerIds: remainingEligible });
  } else if (remainingPot > 0) {
    // Edge case: remaining money but only folded players above threshold
    // Add to the last pot
    if (pots.length > 0) {
      pots[pots.length - 1].amount += remainingPot;
    }
  }

  const mainPot = pots.reduce((sum, p) => sum + p.amount, 0);

  return { mainPot, sidePots: pots };
}
