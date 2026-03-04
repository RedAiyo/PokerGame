import type { Card, Suit, Rank } from './types.js';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * Creates a standard 52-card deck.
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Shuffles the deck in-place using the Fisher-Yates algorithm.
 * Returns the same array reference.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Deals (pops) `count` cards from the end of the deck.
 * Throws if the deck doesn't have enough cards.
 */
export function dealCards(deck: Card[], count: number): Card[] {
  if (deck.length < count) {
    throw new Error(`Not enough cards in deck: need ${count}, have ${deck.length}`);
  }
  const dealt: Card[] = [];
  for (let i = 0; i < count; i++) {
    dealt.push(deck.pop()!);
  }
  return dealt;
}
