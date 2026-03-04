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

interface GameState {
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

export function useGame(roomId: string) {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
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
        const data = await api.get<GameState>(`/games/${roomId}`);
        setGameState(data);
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
          const newState = payload.payload as GameState;
          // Preserve hole cards from private channel
          if (prev?.holeCards && !newState.holeCards) {
            return { ...newState, holeCards: prev.holeCards };
          }
          return newState;
        });
      })
      .on('broadcast', { event: 'game_over' }, (payload) => {
        setGameState(payload.payload as GameState);
      })
      .subscribe();

    // Subscribe to private channel for hole cards
    let privateChannel: ReturnType<typeof supabase.channel> | null = null;

    if (user?.id) {
      privateChannel = supabase
        .channel(`room:${roomId}:private:${user.id}`)
        .on('broadcast', { event: 'hole_cards' }, (payload) => {
          const { cards } = payload.payload as { cards: string[] };
          setGameState((prev) => {
            if (!prev) return prev;
            return { ...prev, holeCards: cards };
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
