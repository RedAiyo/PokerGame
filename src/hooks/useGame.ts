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
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
  winners?: any[];
  holeCards?: string[];
}

interface ServerCard {
  rank: string;
  suit: string;
}

interface ServerPlayer {
  userId: string;
  username?: string;
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
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
}

interface StartGameResponse {
  game: unknown;
  state: ServerGameState;
}

interface ActionResponse {
  result: unknown;
  state: ServerGameState | null;
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

function getNextOccupiedSeat(players: ServerPlayer[], currentSeat: number): number {
  const seats = players.map((player) => player.seatIndex).sort((a, b) => a - b);
  for (const seat of seats) {
    if (seat > currentSeat) {
      return seat;
    }
  }
  return seats[0] ?? -1;
}

function normalizeGameState(serverState: ServerGameState, currentUserId?: string): UiGameState {
  const players: Player[] = serverState.players.map((player) => ({
    id: player.userId,
    username: player.username ?? `Player ${player.seatIndex}`,
    seatIndex: player.seatIndex,
    chips: player.chips,
    bet: player.currentBet,
    folded: player.status === 'folded',
    isDealer: player.seatIndex === serverState.dealerSeat,
    isCurrentTurn: player.seatIndex === serverState.currentTurnSeat,
    holeCards: player.holeCards?.map(toCardString) ?? [],
  }));

  const smallBlindSeat = players.length === 2
    ? serverState.dealerSeat
    : getNextOccupiedSeat(serverState.players, serverState.dealerSeat);
  const bigBlindSeat = getNextOccupiedSeat(serverState.players, smallBlindSeat);

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
    smallBlindIndex: players.findIndex((player) => player.seatIndex === smallBlindSeat),
    bigBlindIndex: players.findIndex((player) => player.seatIndex === bigBlindSeat),
    smallBlind: serverState.smallBlind,
    bigBlind: serverState.bigBlind,
    minRaise: serverState.minRaise,
    holeCards: currentUserId
      ? players.find((player) => player.id === currentUserId)?.holeCards ?? []
      : undefined,
  };
}

export function useGame(roomId: string) {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<UiGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startGame = useCallback(async (id: string) => {
    const response = await api.post<StartGameResponse>(`/games/${id}/start`);
    if (response.state) {
      setGameState(normalizeGameState(response.state, user?.id));
    }
    return response;
  }, [user?.id]);

  const sendAction = useCallback(
    async (gameId: string, action: string, amount?: number) => {
      const response = await api.post<ActionResponse>(`/games/${gameId}/action`, { action, amount });
      if (response.state) {
        setGameState((previousState) => {
          const normalizedState = normalizeGameState(response.state as ServerGameState, user?.id);
          if (previousState?.holeCards?.length && !normalizedState.holeCards?.length) {
            return { ...normalizedState, holeCards: previousState.holeCards };
          }
          return normalizedState;
        });
      }
      return response;
    },
    [user?.id]
  );

  useEffect(() => {
    if (!roomId) return;

    const fetchGameState = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<ServerGameState>(`/games/room/${roomId}/state`);
        setGameState(normalizeGameState(data, user?.id));
      } catch (err: any) {
        if (!err.message?.includes('not found')) {
          setError(err.message || 'Failed to fetch game state');
        }
        setGameState(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchGameState();

    const gameChannel = supabase
      .channel(`room:${roomId}`)
      .on('broadcast', { event: 'game_state' }, (payload) => {
        setGameState((previousState) => {
          const newState = payload.payload as ServerGameState;
          const normalizedState = normalizeGameState(newState, user?.id);
          if (previousState?.holeCards?.length && !normalizedState.holeCards?.length) {
            return { ...normalizedState, holeCards: previousState.holeCards };
          }
          return normalizedState;
        });
      })
      .on('broadcast', { event: 'game_over' }, (payload) => {
        setGameState(normalizeGameState(payload.payload as ServerGameState, user?.id));
      })
      .subscribe();

    let privateChannel: ReturnType<typeof supabase.channel> | null = null;

    if (user?.id) {
      privateChannel = supabase
        .channel(`room:${roomId}:private:${user.id}`)
        .on('broadcast', { event: 'hole_cards' }, (payload) => {
          const { holeCards } = payload.payload as { holeCards: ServerCard[] };
          const mappedHoleCards = (holeCards ?? []).map(toCardString);

          setGameState((previousState) => {
            if (!previousState) return previousState;
            return {
              ...previousState,
              holeCards: mappedHoleCards,
              players: previousState.players.map((player) => (
                player.id === user.id ? { ...player, holeCards: mappedHoleCards } : player
              )),
            };
          });
        })
        .subscribe();
    }

    return () => {
      void supabase.removeChannel(gameChannel);
      if (privateChannel) {
        void supabase.removeChannel(privateChannel);
      }
    };
  }, [roomId, user?.id]);

  return { gameState, loading, error, startGame, sendAction };
}
