import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

interface ServerRoom {
  id: string;
  name: string;
  room_type?: string;
  type?: string;
  small_blind: number;
  big_blind: number;
  min_buy_in: number;
  max_buy_in: number;
  max_players: number;
  player_count: number;
  status: string;
  is_private: boolean;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  type: string;
  roomType: string;
  small_blind: number;
  big_blind: number;
  min_buy_in: number;
  max_buy_in: number;
  max_players: number;
  player_count: number;
  status: string;
  is_private: boolean;
  created_at: string;
}

interface CreateRoomData {
  name: string;
  room_type?: string;
  small_blind?: number;
  big_blind?: number;
  min_buy_in?: number;
  max_buy_in?: number;
  max_players?: number;
  time_limit?: number;
  is_private?: boolean;
  password?: string;
}

function normalizeRoom(room: ServerRoom): Room {
  const roomType = room.room_type ?? room.type ?? '\u65b0\u624b\u573a';
  return {
    ...room,
    type: roomType,
    roomType,
  };
}

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async (type?: string) => {
    try {
      setLoading(true);
      setError(null);
      const query = type ? `?type=${encodeURIComponent(type)}` : '';
      const data = await api.get<ServerRoom[]>(`/rooms${query}`);
      setRooms((data || []).map(normalizeRoom));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  const createRoom = useCallback(async (data: CreateRoomData) => {
    const room = await api.post<ServerRoom>('/rooms', data);
    return normalizeRoom(room);
  }, []);

  const joinRoom = useCallback(
    async (roomId: string, seatIndex: number | undefined, buyIn: number, password?: string) => {
      const payload: Record<string, unknown> = { buy_in: buyIn, password };
      if (seatIndex !== undefined) {
        payload.seat_index = seatIndex;
      }
      return api.post(`/rooms/${roomId}/join`, payload);
    },
    []
  );

  const leaveRoom = useCallback(async (roomId: string) => {
    return api.post(`/rooms/${roomId}/leave`);
  }, []);

  useEffect(() => {
    void fetchRooms();

    // Subscribe to lobby channel for real-time room updates.
    const channel = supabase
      .channel('lobby')
      .on('broadcast', { event: 'room_update' }, (payload) => {
        const updatedRoom = normalizeRoom(payload.payload as ServerRoom);
        setRooms((prev) => {
          const index = prev.findIndex((room) => room.id === updatedRoom.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedRoom;
            return next;
          }
          return [...prev, updatedRoom];
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchRooms]);

  return { rooms, loading, error, fetchRooms, createRoom, joinRoom, leaveRoom };
}
