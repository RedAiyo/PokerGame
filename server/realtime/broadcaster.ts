import { supabaseAdmin } from '../config/supabase.js';
import type { GameState } from '../engine/types.js';

/**
 * Broadcast the full game state to all players in a room.
 * Sends sanitized public state to the room channel, and
 * private hole cards to each player on their private channel.
 */
export async function broadcastGameState(
  roomId: string,
  gameState: GameState,
  players: { userId: string }[]
): Promise<void> {
  // Build public state (hide all hole cards)
  const publicState: GameState = JSON.parse(JSON.stringify(gameState));
  publicState.deck = [];
  if (publicState.phase !== 'showdown' && publicState.phase !== 'complete') {
    for (const p of publicState.players) {
      p.holeCards = [];
    }
  }

  // Broadcast public state to room channel
  const roomChannel = supabaseAdmin.channel(`room:${roomId}`);
  await roomChannel.send({
    type: 'broadcast',
    event: 'game_state',
    payload: publicState,
  });

  // Send private hole cards to each player
  for (const player of players) {
    const playerInState = gameState.players.find(p => p.userId === player.userId);
    if (!playerInState) continue;

    const privateChannel = supabaseAdmin.channel(
      `room:${roomId}:private:${player.userId}`
    );
    await privateChannel.send({
      type: 'broadcast',
      event: 'hole_cards',
      payload: {
        holeCards: playerInState.holeCards,
      },
    });
  }
}

/**
 * Broadcast a chat message to all users in a room.
 */
export async function broadcastChatMessage(
  roomId: string,
  message: {
    id: string;
    user_id: string;
    username: string;
    message: string;
    created_at: string;
  }
): Promise<void> {
  const channel = supabaseAdmin.channel(`room:${roomId}`);
  await channel.send({
    type: 'broadcast',
    event: 'chat',
    payload: message,
  });
}

/**
 * Broadcast a room update to the lobby (for room list refreshing).
 */
export async function broadcastRoomUpdate(room: Record<string, any>): Promise<void> {
  const channel = supabaseAdmin.channel('lobby');
  await channel.send({
    type: 'broadcast',
    event: 'room_update',
    payload: room,
  });
}

/**
 * Broadcast a player action to all users in a room.
 */
export async function broadcastPlayerAction(
  roomId: string,
  userId: string,
  action: string,
  amount?: number
): Promise<void> {
  const channel = supabaseAdmin.channel(`room:${roomId}`);
  await channel.send({
    type: 'broadcast',
    event: 'player_action',
    payload: {
      userId,
      action,
      amount,
    },
  });
}
