import type { GamePlayer, ActionResult, PlayerAction, GameState } from './types.js';
import { GameStateMachine } from './game-state.js';

const DEFAULT_TURN_TIMEOUT_MS = 30_000;

export class GameManager {
  private games: Map<string, GameStateMachine> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private turnTimeoutMs: number;

  constructor(turnTimeoutMs: number = DEFAULT_TURN_TIMEOUT_MS) {
    this.turnTimeoutMs = turnTimeoutMs;
  }

  /**
   * Create a new game for a room and start the first hand.
   */
  createGame(roomId: string, players: GamePlayer[]): GameStateMachine {
    const machine = new GameStateMachine(roomId);
    machine.startHand(players);
    this.games.set(roomId, machine);

    // Start turn timer for the first player
    this.setTimer(roomId);

    return machine;
  }

  /**
   * Get the game state machine for a room.
   */
  getGame(roomId: string): GameStateMachine | undefined {
    return this.games.get(roomId);
  }

  /**
   * Remove a game and clean up its timer.
   */
  removeGame(roomId: string): void {
    this.clearTimer(roomId);
    this.games.delete(roomId);
  }

  /**
   * Process a player action in a room's game.
   * Resets the turn timer on success.
   */
  handleAction(roomId: string, userId: string, action: PlayerAction, amount?: number): ActionResult {
    const game = this.games.get(roomId);
    if (!game) {
      return { valid: false, error: 'No active game in this room' };
    }

    const result = game.handleAction(userId, action, amount);

    if (result.valid) {
      this.clearTimer(roomId);

      // Set timer for next player if game is still in progress
      if (game.state.phase !== 'complete' && game.state.phase !== 'showdown') {
        this.setTimer(roomId);
      }
    }

    return result;
  }

  /**
   * Get the sanitized game state for a player.
   */
  getStateForPlayer(roomId: string, userId: string): GameState | null {
    const game = this.games.get(roomId);
    if (!game) return null;
    return game.getStateForPlayer(userId);
  }

  /**
   * Set the turn timer for the current player. Auto-folds on timeout.
   */
  private setTimer(roomId: string): void {
    this.clearTimer(roomId);

    const game = this.games.get(roomId);
    if (!game) return;

    const currentSeat = game.state.currentTurnSeat;
    const currentPlayer = game.state.players.find(p => p.seatIndex === currentSeat);
    if (!currentPlayer || currentPlayer.status !== 'active') return;

    const timerKey = this.timerKey(roomId);
    const timer = setTimeout(() => {
      // Auto-fold on timeout
      this.handleAction(roomId, currentPlayer.userId, 'fold');
    }, this.turnTimeoutMs);

    this.timers.set(timerKey, timer);
  }

  /**
   * Clear the turn timer for a room.
   */
  private clearTimer(roomId: string): void {
    const timerKey = this.timerKey(roomId);
    const timer = this.timers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(timerKey);
    }
  }

  private timerKey(roomId: string): string {
    return `turn:${roomId}`;
  }

  /**
   * Get all active room IDs.
   */
  getActiveRoomIds(): string[] {
    return Array.from(this.games.keys());
  }

  /**
   * Check if a room has an active game.
   */
  hasGame(roomId: string): boolean {
    return this.games.has(roomId);
  }
}
