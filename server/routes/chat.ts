import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { broadcastChatMessage } from '../realtime/broadcaster.js';

const router = Router();

// GET /:roomId/chat - get chat messages for a room
router.get('/:roomId/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('*, profiles(username)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const messages = (data || []).map((msg: any) => ({
      id: msg.id,
      user_id: msg.user_id,
      username: msg.profiles?.username ?? 'Unknown',
      message: msg.message,
      created_at: msg.created_at,
    }));

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

// POST /:roomId/chat - send a chat message
router.post('/:roomId/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { roomId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Insert into chat_messages
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        room_id: roomId,
        user_id: userId,
        message: message.trim(),
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Get username for broadcast
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    const chatMessage = {
      id: data.id,
      user_id: data.user_id,
      username: profile?.username ?? 'Unknown',
      message: data.message,
      created_at: data.created_at,
    };

    // Broadcast chat message
    await broadcastChatMessage(roomId, chatMessage);

    res.status(201).json(chatMessage);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send chat message' });
  }
});

export default router;
