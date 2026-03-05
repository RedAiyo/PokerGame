import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
}

export function useChat(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<ChatMessage[]>(`/rooms/${roomId}/chat`);
      setMessages(data);
    } catch {
      // Silently fail - chat is not critical
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const sendMessage = useCallback(
    async (message: string) => {
      await api.post(`/rooms/${roomId}/chat`, { message });
    },
    [roomId]
  );

  useEffect(() => {
    if (!roomId) return;

    fetchMessages();

    // Subscribe to chat messages on the room channel
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('broadcast', { event: 'chat' }, (payload) => {
        const newMessage = payload.payload as ChatMessage;
        setMessages((prev) => [...prev, newMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMessages]);

  return { messages, loading, sendMessage };
}
