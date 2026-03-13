import crypto from 'node:crypto';
import type {
  GameState, GamePlayer, Phase, PlayerAction, ActionResult,
  Winner, Card, SidePot,
} from './types.js';
import { createDeck, shuffleDeck, dealCards } from './deck.js';
import { evaluateHand, compareHands } from './hand-evaluator.js';
import { calculatePots } from './pot-calculator.js';
import type { GameConfig } from './game-manager.js';

const DEFAULT_BIG_BLIND = 20;
const DEFAULT_SMALL_BLIND = 10;

export class GameStateMachine {
  public state: GameState;

  constructor(roomId: string, config: GameConfig = {}) {
    const smallBlind = config.smallBlind ?? DEFAULT_SMALL_BLIND;
    const bigBlind = config.bigBlind ?? DEFAULT_BIG_BLIND;

    this.state = {
      id: crypto.randomUUID(),
      roomId,
      handNumber: 0,
      smallBlind,
      bigBlind,
      phase: 'waiting',
      players: [],
      communityCards: [],
      pot: 0,
      sidePots: [],
      dealerSeat: 0,
      currentTurnSeat: -1,
      lastRaise: bigBlind,
      minRaise: bigBlind,
      deck: [],
    };
  }

  /**
   * Start a new hand: shuffle, deal hole cards, post blinds, set phase to preflop.
   */
  startHand(players: GamePlayer[]): void {
    if (players.length < 2) {
      throw new Error('Need at least 2 players to start a hand');
    }

    this.state.handNumber++;
    this.state.phase = 'preflop';
    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.sidePots = [];
    this.state.lastRaise = this.state.bigBlind;
    this.state.minRaise = this.state.bigBlind;

    // Reset players
    this.state.players = players.map(p => ({
      ...p,
      holeCards: [],
      status: 'active' as const,
      currentBet: 0,
      hasActed: false,
    }));

    // Sort players by seat index
    this.state.players.sort((a, b) => a.seatIndex - b.seatIndex);

    // Advance dealer
    if (this.state.handNumber > 1) {
      this.state.dealerSeat = this.findNextOccupiedSeat(this.state.dealerSeat);
    } else {
      this.state.dealerSeat = this.state.players[0].seatIndex;
    }

    // Create and shuffle deck
    this.state.deck = shuffleDeck(createDeck());

    // Deal 2 hole cards to each player
    for (const player of this.state.players) {
      player.holeCards = dealCards(this.state.deck, 2);
    }

    // Post blinds
    const numPlayers = this.state.players.length;
    if (numPlayers === 2) {
      // Heads-up: dealer posts small blind, other posts big blind
      const sbPlayer = this.getPlayerBySeat(this.state.dealerSeat)!;
      const bbSeat = this.findNextOccupiedSeat(this.state.dealerSeat);
      const bbPlayer = this.getPlayerBySeat(bbSeat)!;

      this.postBlind(sbPlayer, this.state.smallBlind);
      this.postBlind(bbPlayer, this.state.bigBlind);

      // In heads-up, dealer (SB) acts first preflop
      this.state.currentTurnSeat = this.state.dealerSeat;
    } else {
      // SB is next after dealer, BB is next after SB
      const sbSeat = this.findNextOccupiedSeat(this.state.dealerSeat);
      const bbSeat = this.findNextOccupiedSeat(sbSeat);
      const sbPlayer = this.getPlayerBySeat(sbSeat)!;
      const bbPlayer = this.getPlayerBySeat(bbSeat)!;

      this.postBlind(sbPlayer, this.state.smallBlind);
      this.postBlind(bbPlayer, this.state.bigBlind);

      // First to act preflop is after BB (UTG)
      this.state.currentTurnSeat = this.findNextOccupiedSeat(bbSeat);
    }
  }

  private postBlind(player: GamePlayer, amount: number): void {
    const blindAmount = Math.min(amount, player.chips);
    player.chips -= blindAmount;
    player.currentBet = blindAmount;
    this.state.pot += blindAmount;

    if (player.chips === 0) {
      player.status = 'all_in';
    }
  }

  /**
   * Handle a player action. Returns ActionResult with validity and any state transitions.
   */
  handleAction(userId: string, action: PlayerAction, amount?: number): ActionResult {
    const player = this.state.players.find(p => p.userId === userId);
    if (!player) {
      return { valid: false, error: 'Player not found' };
    }

    if (player.seatIndex !== this.state.currentTurnSeat) {
      return { valid: false, error: 'Not your turn' };
    }

    if (player.status !== 'active') {
      return { valid: false, error: 'Player cannot act (folded or all-in)' };
    }

    const highestBet = this.getHighestBet();
    const toCall = highestBet - player.currentBet;

    // Validate and execute action
    switch (action) {
      case 'fold':
        player.status = 'folded';
        player.hasActed = true;
        break;

      case 'check':
        if (toCall > 0) {
          return { valid: false, error: 'Cannot check, there is a bet to call' };
        }
        player.hasActed = true;
        break;

      case 'call': {
        if (toCall === 0) {
          return { valid: false, error: 'Nothing to call, use check instead' };
        }
        const callAmount = Math.min(toCall, player.chips);
        player.chips -= callAmount;
        player.currentBet += callAmount;
        this.state.pot += callAmount;
        player.hasActed = true;

        if (player.chips === 0) {
          player.status = 'all_in';
        }
        break;
      }

      case 'raise': {
        if (amount === undefined || amount <= 0) {
          return { valid: false, error: 'Raise amount is required' };
        }

        // `amount` is the total bet the player wants to have in front of them
        const raiseTotal = amount;
        const raiseIncrement = raiseTotal - highestBet;

        // Minimum raise must be at least the last raise size, unless going all-in
        if (raiseIncrement < this.state.minRaise && raiseTotal < player.chips + player.currentBet) {
          return {
            valid: false,
            error: `Raise must be at least ${this.state.minRaise} more than the current bet of ${highestBet} (total: ${highestBet + this.state.minRaise}), or go all-in`,
          };
        }

        const additionalChips = raiseTotal - player.currentBet;
        if (additionalChips > player.chips) {
          return { valid: false, error: 'Not enough chips for this raise' };
        }

        player.chips -= additionalChips;
        this.state.pot += additionalChips;
        player.currentBet = raiseTotal;
        player.hasActed = true;

        // Update raise tracking
        this.state.lastRaise = raiseIncrement;
        this.state.minRaise = raiseIncrement;

        // Reset hasActed for all other active players since there's a new raise
        for (const p of this.state.players) {
          if (p.userId !== userId && p.status === 'active') {
            p.hasActed = false;
          }
        }

        if (player.chips === 0) {
          player.status = 'all_in';
        }
        break;
      }

      case 'all_in': {
        const allInAmount = player.chips;
        const newBet = player.currentBet + allInAmount;

        // If this is a raise, update raise tracking
        if (newBet > highestBet) {
          const raiseIncrement = newBet - highestBet;
          if (raiseIncrement >= this.state.minRaise) {
            this.state.lastRaise = raiseIncrement;
            this.state.minRaise = raiseIncrement;
          }
          // Reset hasActed for other active players
          for (const p of this.state.players) {
            if (p.userId !== userId && p.status === 'active') {
              p.hasActed = false;
            }
          }
        }

        this.state.pot += allInAmount;
        player.chips = 0;
        player.currentBet = newBet;
        player.status = 'all_in';
        player.hasActed = true;
        break;
      }

      default:
        return { valid: false, error: `Unknown action: ${action}` };
    }

    // Check if only one player remains (everyone else folded)
    const activePlayers = this.state.players.filter(p => p.status !== 'folded');
    if (activePlayers.length === 1) {
      // Last player standing wins
      const winner = activePlayers[0];
      const winners: Winner[] = [{ userId: winner.userId, amount: this.state.pot }];
      winner.chips += this.state.pot;
      this.state.pot = 0;
      this.state.phase = 'complete';
      return { valid: true, nextPhase: 'complete', winners };
    }

    // Check if the betting round is complete
    if (this.isRoundComplete()) {
      return this.advancePhase();
    }

    // Move to next player
    this.state.currentTurnSeat = this.findNextActivePlayer(this.state.currentTurnSeat);

    return { valid: true };
  }

  /**
   * Check if the current betting round is complete.
   * All active players must have acted and bets must be equal.
   */
  isRoundComplete(): boolean {
    const activePlayers = this.state.players.filter(p => p.status === 'active');

    // If no active players remain (all are folded or all-in), round is complete
    if (activePlayers.length === 0) {
      return true;
    }

    // All active players must have acted
    if (activePlayers.some(p => !p.hasActed)) {
      return false;
    }

    // All active player bets must be equal
    const bets = activePlayers.map(p => p.currentBet);
    return bets.every(b => b === bets[0]);
  }

  /**
   * Advance to the next phase. Deals community cards, resets bets.
   */
  advancePhase(): ActionResult {
    const phaseOrder: Phase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIndex = phaseOrder.indexOf(this.state.phase);

    if (currentIndex === -1 || currentIndex >= phaseOrder.length - 1) {
      // Already at showdown or beyond
      if (this.state.phase === 'showdown') {
        return this.resolveShowdown();
      }
      return { valid: true };
    }

    const nextPhase = phaseOrder[currentIndex + 1];

    // Reset bets for new street
    for (const p of this.state.players) {
      p.currentBet = 0;
      if (p.status === 'active') {
        p.hasActed = false;
      }
    }
    this.state.lastRaise = this.state.bigBlind;
    this.state.minRaise = this.state.bigBlind;

    // Deal community cards
    switch (nextPhase) {
      case 'flop':
        // Burn 1, deal 3
        dealCards(this.state.deck, 1); // burn
        this.state.communityCards.push(...dealCards(this.state.deck, 3));
        break;
      case 'turn':
        // Burn 1, deal 1
        dealCards(this.state.deck, 1); // burn
        this.state.communityCards.push(...dealCards(this.state.deck, 1));
        break;
      case 'river':
        // Burn 1, deal 1
        dealCards(this.state.deck, 1); // burn
        this.state.communityCards.push(...dealCards(this.state.deck, 1));
        break;
      case 'showdown':
        return this.resolveShowdown();
    }

    this.state.phase = nextPhase;

    // Check if all remaining players are all-in (no more betting possible)
    const activePlayers = this.state.players.filter(p => p.status === 'active');
    if (activePlayers.length <= 1) {
      // No more betting rounds; deal remaining cards and go to showdown
      return this.runOutBoard();
    }

    // Set turn to first active player after dealer
    this.state.currentTurnSeat = this.findNextActivePlayer(this.state.dealerSeat);

    return { valid: true, nextPhase };
  }

  /**
   * When no more betting is possible (all-in), deal remaining community cards.
   */
  private runOutBoard(): ActionResult {
    while (this.state.communityCards.length < 5) {
      dealCards(this.state.deck, 1); // burn
      this.state.communityCards.push(...dealCards(this.state.deck, 1));
    }
    return this.resolveShowdown();
  }

  /**
   * Resolve the showdown: evaluate hands, determine winners, distribute pots.
   */
  private resolveShowdown(): ActionResult {
    this.state.phase = 'showdown';

    const activePlayers = this.state.players.filter(p => p.status !== 'folded');
    const potResult = calculatePots(this.state.players);

    const winners: Winner[] = [];

    if (potResult.sidePots.length === 0) {
      // Simple case: one pot
      const winner = this.findBestHand(activePlayers);
      if (winner) {
        const eval_ = evaluateHand([...winner.holeCards, ...this.state.communityCards]);
        winners.push({
          userId: winner.userId,
          amount: this.state.pot,
          hand: eval_.description,
        });
        winner.chips += this.state.pot;
      }
    } else {
      // Distribute each side pot
      for (const sidePot of potResult.sidePots) {
        const eligiblePlayers = activePlayers.filter(
          p => sidePot.eligiblePlayerIds.includes(p.userId)
        );

        if (eligiblePlayers.length === 0) continue;

        if (eligiblePlayers.length === 1) {
          eligiblePlayers[0].chips += sidePot.amount;
          winners.push({
            userId: eligiblePlayers[0].userId,
            amount: sidePot.amount,
          });
          continue;
        }

        // Evaluate hands and find winner(s) for this pot
        const evaluations = eligiblePlayers.map(p => ({
          player: p,
          eval: evaluateHand([...p.holeCards, ...this.state.communityCards]),
        }));

        evaluations.sort((a, b) => compareHands(b.eval, a.eval));

        // Find all players tied for best hand
        const bestEval = evaluations[0].eval;
        const potWinners = evaluations.filter(e => compareHands(e.eval, bestEval) === 0);

        const splitAmount = Math.floor(sidePot.amount / potWinners.length);
        const remainder = sidePot.amount - splitAmount * potWinners.length;

        potWinners.forEach((pw, index) => {
          const winAmount = splitAmount + (index === 0 ? remainder : 0);
          pw.player.chips += winAmount;
          winners.push({
            userId: pw.player.userId,
            amount: winAmount,
            hand: pw.eval.description,
          });
        });
      }
    }

    this.state.pot = 0;
    this.state.phase = 'complete';

    return { valid: true, nextPhase: 'complete', winners };
  }

  /**
   * Find the player with the best hand among the given players.
   */
  private findBestHand(players: GamePlayer[]): GamePlayer | null {
    if (players.length === 0) return null;

    let bestPlayer = players[0];
    let bestEval = evaluateHand([...bestPlayer.holeCards, ...this.state.communityCards]);

    for (let i = 1; i < players.length; i++) {
      const eval_ = evaluateHand([...players[i].holeCards, ...this.state.communityCards]);
      if (compareHands(eval_, bestEval) > 0) {
        bestPlayer = players[i];
        bestEval = eval_;
      }
    }

    return bestPlayer;
  }

  /**
   * Find the next occupied seat clockwise (any status).
   */
  private findNextOccupiedSeat(currentSeat: number): number {
    const seats = this.state.players.map(p => p.seatIndex).sort((a, b) => a - b);
    for (const seat of seats) {
      if (seat > currentSeat) return seat;
    }
    return seats[0]; // wrap around
  }

  /**
   * Find the next active (non-folded, non-all-in) player clockwise.
   */
  findNextActivePlayer(currentSeat: number): number {
    const players = this.state.players
      .filter(p => p.status === 'active')
      .sort((a, b) => a.seatIndex - b.seatIndex);

    if (players.length === 0) return -1;

    for (const p of players) {
      if (p.seatIndex > currentSeat) return p.seatIndex;
    }
    return players[0].seatIndex; // wrap around
  }

  /**
   * Get the highest current bet among all players.
   */
  private getHighestBet(): number {
    return Math.max(0, ...this.state.players.map(p => p.currentBet));
  }

  private getPlayerBySeat(seatIndex: number): GamePlayer | undefined {
    return this.state.players.find(p => p.seatIndex === seatIndex);
  }

  /**
   * Return a sanitized game state for a specific player.
   * Hides other players' hole cards unless in showdown.
   */
  getStateForPlayer(userId: string): GameState {
    const sanitized = JSON.parse(JSON.stringify(this.state)) as GameState;

    // Remove deck from client view
    sanitized.deck = [];

    // Hide other players' hole cards unless showdown/complete
    if (sanitized.phase !== 'showdown' && sanitized.phase !== 'complete') {
      for (const player of sanitized.players) {
        if (player.userId !== userId) {
          player.holeCards = [];
        }
      }
    }

    return sanitized;
  }

  /**
   * Determine winners (convenience method, delegates to showdown logic).
   */
  determineWinners(): Winner[] {
    const result = this.resolveShowdown();
    return result.winners || [];
  }
}
