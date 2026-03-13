import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { GameManager } from '../engine/game-manager.js';
import type { GamePlayer } from '../engine/types.js';
import {
  broadcastGameState,
  broadcastPlayerAction,
} from '../realtime/broadcaster.js';

// Shared singleton game manager
export const gameManager = new GameManager();

const router = Router();

// POST /:roomId/start - start a game
router.post('/:roomId/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { roomId } = req.params;

    // Verify room exists
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Verify user is in the room
    const { data: roomPlayers, error: playersError } = await supabaseAdmin
      .from('room_players')
      .select('*, profiles(username)')
      .eq('room_id', roomId);

    if (playersError) {
      res.status(500).json({ error: playersError.message });
      return;
    }

    const currentPlayer = (roomPlayers || []).find((p: any) => p.user_id === userId);
    if (!currentPlayer) {
      res.status(403).json({ error: 'You are not in this room' });
      return;
    }

    if ((roomPlayers || []).length < 2) {
      res.status(400).json({ error: 'Need at least 2 players to start' });
      return;
    }

    if (gameManager.hasGame(roomId)) {
      res.status(400).json({ error: 'A game is already in progress in this room' });
      return;
    }

    // Convert room_players to GamePlayer[] format
    const players: GamePlayer[] = (roomPlayers || []).map((p: any) => ({
      userId: p.user_id,
      username: p.profiles?.username ?? undefined,
      seatIndex: p.seat_index,
      chips: p.chips,
      holeCards: [],
      status: 'active' as const,
      currentBet: 0,
      hasActed: false,
    }));

    // Create game
    const machine = gameManager.createGame(roomId, players, {
      smallBlind: room.small_blind,
      bigBlind: room.big_blind,
    });
    const gameState = machine.state;

    // Insert game record into games table
    const { data: gameRecord, error: gameError } = await supabaseAdmin
      .from('games')
      .insert({
        id: gameState.id,
        room_id: roomId,
        hand_number: gameState.handNumber,
        phase: gameState.phase,
        pot: gameState.pot,
        community_cards: gameState.communityCards,
        dealer_seat: gameState.dealerSeat,
        current_turn_seat: gameState.currentTurnSeat,
      })
      .select()
      .single();

    if (gameError) {
      gameManager.removeGame(roomId);
      res.status(500).json({ error: gameError.message });
      return;
    }

    // Insert game_players records
    const gamePlayers = gameState.players.map((p) => ({
      game_id: gameState.id,
      user_id: p.userId,
      hole_cards: p.holeCards,
      status: p.status,
      current_bet: p.currentBet,
    }));

    await supabaseAdmin.from('game_players').insert(gamePlayers);

    // Update room status
    await supabaseAdmin
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', roomId);

    // Broadcast initial state to all players
    await broadcastGameState(roomId, gameState, players);

    // Return state for the requesting player
    const playerState = gameManager.getStateForPlayer(roomId, userId);
    res.status(201).json({ game: gameRecord, state: playerState });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// POST /:gameId/action - perform game action
router.post('/:gameId/action', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { gameId } = req.params;
    const { action, amount } = req.body;

    if (!action) {
      res.status(400).json({ error: 'Action is required' });
      return;
    }

    // Find the game's roomId
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('room_id')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const roomId = game.room_id;

    // Handle the action
    const result = gameManager.handleAction(roomId, userId, action, amount);

    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Broadcast the player action
    await broadcastPlayerAction(roomId, userId, action, amount);

    // Get updated game state
    const machine = gameManager.getGame(roomId);
    let playerState = gameManager.getStateForPlayer(roomId, userId);

    if (machine) {
      const gameState = machine.state;

      // Update game record in DB
      await supabaseAdmin
        .from('games')
        .update({
          phase: gameState.phase,
          pot: gameState.pot,
          community_cards: gameState.communityCards,
          current_turn_seat: gameState.currentTurnSeat,
        })
        .eq('id', gameId);

      // Broadcast updated state
      const players = gameState.players.map((p) => ({ userId: p.userId }));
      await broadcastGameState(roomId, gameState, players);

      // If game is complete, finalize
      if (gameState.phase === 'complete' && result.winners) {
        // Update game status
        await supabaseAdmin
          .from('games')
          .update({ phase: 'complete' })
          .eq('id', gameId);

        // Update game_players with final chips and status
        for (const player of gameState.players) {
          await supabaseAdmin
            .from('game_players')
            .update({
              hole_cards: player.holeCards,
              current_bet: player.currentBet,
              status: player.status,
            })
            .eq('game_id', gameId)
            .eq('user_id', player.userId);

          // Update room_players chips
          await supabaseAdmin
            .from('room_players')
            .update({ chips: player.chips })
            .eq('room_id', roomId)
            .eq('user_id', player.userId);
        }

        // Update room status back to waiting
        await supabaseAdmin
          .from('rooms')
          .update({ status: 'waiting' })
          .eq('id', roomId);

        // Preserve the final state for the acting player before the in-memory game is cleaned up.
        playerState = machine.getStateForPlayer(userId);

        // Clean up game manager
        gameManager.removeGame(roomId);
      } else {
        playerState = machine.getStateForPlayer(userId);
      }
    }

    res.json({ result, state: playerState });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process action' });
  }
});

// GET /room/:roomId/state - get current game state by room
router.get('/room/:roomId/state', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { roomId } = req.params;

    const state = gameManager.getStateForPlayer(roomId, userId);
    if (!state) {
      res.status(404).json({ error: 'No active game found' });
      return;
    }

    res.json(state);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// GET /:gameId/state - get current game state
router.get('/:gameId/state', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { gameId } = req.params;

    // Find the game's roomId
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('room_id')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const state = gameManager.getStateForPlayer(game.room_id, userId);
    if (!state) {
      res.status(404).json({ error: 'No active game found' });
      return;
    }

    res.json(state);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

export default router;
