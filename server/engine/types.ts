export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Phase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete';

export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all_in';
export type PlayerStatus = 'active' | 'folded' | 'all_in';

export interface GamePlayer {
  userId: string;
  seatIndex: number;
  chips: number;
  holeCards: Card[];
  status: PlayerStatus;
  currentBet: number;
  hasActed: boolean;
}

export interface GameState {
  id: string;
  roomId: string;
  handNumber: number;
  phase: Phase;
  players: GamePlayer[];
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  dealerSeat: number;
  currentTurnSeat: number;
  lastRaise: number;
  minRaise: number;
  deck: Card[];
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface ActionResult {
  valid: boolean;
  error?: string;
  nextPhase?: Phase;
  winners?: Winner[];
}

export interface Winner {
  userId: string;
  amount: number;
  hand?: string;
}

export type HandRank =
  | 'royal_flush' | 'straight_flush' | 'four_of_a_kind' | 'full_house'
  | 'flush' | 'straight' | 'three_of_a_kind' | 'two_pair' | 'one_pair' | 'high_card';

export interface HandEvaluation {
  rank: HandRank;
  rankValue: number;
  tiebreakers: number[];
  description: string;
  bestCards: Card[];
}
