import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

interface Room {
  id: string;
  name: string;
  type: string;
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
  type?: string;
  small_blind?: number;
  big_blind?: number;
  min_buy_in?: number;
  max_buy_in?: number;
  max_players?: number;
  password?: string;
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
      const data = await api.get<Room[]>(`/rooms${query}`);
      setRooms(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  const createRoom = useCallback(async (data: CreateRoomData) => {
    const room = await api.post<Room>('/rooms', data);
    return room;
  }, []);

  const joinRoom = useCallback(
    async (roomId: string, seatIndex: number, buyIn: number, password?: string) => {
      return api.post(`/rooms/${roomId}/join`, { seatIndex, buyIn, password });
    },
    []
  );

  const leaveRoom = useCallback(async (roomId: string) => {
    return api.post(`/rooms/${roomId}/leave`);
  }, []);

  useEffect(() => {
    fetchRooms();

    // Subscribe to lobby channel for real-time room updates
    const channel = supabase
      .channel('lobby')
      .on('broadcast', { event: 'room_update' }, (payload) => {
        const updatedRoom = payload.payload as Room;
        setRooms((prev) => {
          const index = prev.findIndex((r) => r.id === updatedRoom.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedRoom;
            return next;
          }
          return [...prev, updatedRoom];
        });
      })
      .on('broadcast', { event: 'room_created' }, (payload) => {
        const newRoom = payload.payload as Room;
        setRooms((prev) => [...prev, newRoom]);
      })
      .on('broadcast', { event: 'room_deleted' }, (payload) => {
        const { id } = payload.payload as { id: string };
        setRooms((prev) => prev.filter((r) => r.id !== id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRooms]);

  return { rooms, loading, error, fetchRooms, createRoom, joinRoom, leaveRoom };
}
