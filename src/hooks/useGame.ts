import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface Player {
  id: string;
  username: string;
  seatIndex: number;
  chips: number;
  bet: number;
  folded: boolean;
  isDealer: boolean;
  isCurrentTurn: boolean;
  holeCards?: string[];
}

interface UiGameState {
  id: string;
  roomId: string;
  status: string;
  phase: string;
  pot: number;
  communityCards: string[];
  players: Player[];
  currentBet: number;
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  winners?: any[];
  holeCards?: string[];
}

interface ServerCard {
  rank: string;
  suit: string;
}

interface ServerPlayer {
  userId: string;
  seatIndex: number;
  chips: number;
  currentBet: number;
  status: 'active' | 'folded' | 'all_in';
  holeCards: ServerCard[];
}

interface ServerGameState {
  id: string;
  roomId: string;
  phase: string;
  pot: number;
  communityCards: ServerCard[];
  players: ServerPlayer[];
  currentTurnSeat: number;
  dealerSeat: number;
}

function toCardString(card: ServerCard): string {
  const suitMap: Record<string, string> = {
    hearts: 'h',
    diamonds: 'd',
    clubs: 'c',
    spades: 's',
  };
  return `${card.rank}${suitMap[card.suit] ?? card.suit}`;
}

function normalizeGameState(serverState: ServerGameState): UiGameState {
  const players: Player[] = serverState.players.map((player) => ({
    id: player.userId,
    username: `玩家${player.seatIndex}`,
    seatIndex: player.seatIndex,
    chips: player.chips,
    bet: player.currentBet,
    folded: player.status === 'folded',
    isDealer: player.seatIndex === serverState.dealerSeat,
    isCurrentTurn: player.seatIndex === serverState.currentTurnSeat,
    holeCards: player.holeCards?.map(toCardString) ?? [],
  }));

  return {
    id: serverState.id,
    roomId: serverState.roomId,
    status: serverState.phase === 'complete' ? 'completed' : 'active',
    phase: serverState.phase,
    pot: serverState.pot,
    communityCards: serverState.communityCards.map(toCardString),
    players,
    currentBet: Math.max(0, ...players.map((player) => player.bet)),
    currentPlayerIndex: players.findIndex((player) => player.isCurrentTurn),
    dealerIndex: players.findIndex((player) => player.isDealer),
    smallBlindIndex: -1,
    bigBlindIndex: -1,
  };
}

export function useGame(roomId: string) {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<UiGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startGame = useCallback(async (id: string) => {
    return api.post(`/games/${id}/start`);
  }, []);

  const sendAction = useCallback(
    async (gameId: string, action: string, amount?: number) => {
      return api.post(`/games/${gameId}/action`, { action, amount });
    },
    []
  );

  useEffect(() => {
    if (!roomId) return;

    // Fetch initial game state
    const fetchGameState = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<ServerGameState>(`/games/room/${roomId}/state`);
        setGameState(normalizeGameState(data));
      } catch (err: any) {
        // No active game is not necessarily an error
        if (!err.message?.includes('not found')) {
          setError(err.message || 'Failed to fetch game state');
        }
        setGameState(null);
      } finally {
        setLoading(false);
      }
    };

    fetchGameState();

    // Subscribe to public game state channel
    const gameChannel = supabase
      .channel(`room:${roomId}`)
      .on('broadcast', { event: 'game_state' }, (payload) => {
        setGameState((prev) => {
          const newState = payload.payload as ServerGameState;
          const normalizedState = normalizeGameState(newState);
          // Preserve hole cards from private channel
          if (prev?.holeCards && !normalizedState.holeCards) {
            return { ...normalizedState, holeCards: prev.holeCards };
          }
          return normalizedState;
        });
      })
      .on('broadcast', { event: 'game_over' }, (payload) => {
        setGameState(normalizeGameState(payload.payload as ServerGameState));
      })
      .subscribe();

    // Subscribe to private channel for hole cards
    let privateChannel: ReturnType<typeof supabase.channel> | null = null;

    if (user?.id) {
      privateChannel = supabase
        .channel(`room:${roomId}:private:${user.id}`)
        .on('broadcast', { event: 'hole_cards' }, (payload) => {
          const { holeCards } = payload.payload as { holeCards: ServerCard[] };
          setGameState((prev) => {
            if (!prev) return prev;
            return { ...prev, holeCards: (holeCards ?? []).map(toCardString) };
          });
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(gameChannel);
      if (privateChannel) {
        supabase.removeChannel(privateChannel);
      }
    };
  }, [roomId, user?.id]);

  return { gameState, loading, error, startGame, sendAction };
}
