import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET / - list rooms
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    let query = supabaseAdmin
      .from('rooms')
      .select('*, room_players(count)')
      .neq('status', 'closed');

    if (type) {
      query = query.eq('room_type', type);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const rooms = (data || []).map((room: any) => ({
      ...room,
      player_count: room.room_players?.[0]?.count ?? 0,
      room_players: undefined,
    }));

    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// POST / - create room
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const {
      name,
      small_blind,
      big_blind,
      min_buy_in,
      max_buy_in,
      max_players,
      time_limit,
      room_type,
      is_private,
      password,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Room name is required' });
      return;
    }

    let hashedPassword: string | null = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .insert({
        name,
        creator_id: userId,
        small_blind: small_blind || 10,
        big_blind: big_blind || 20,
        min_buy_in: min_buy_in || 100,
        max_buy_in: max_buy_in || 1000,
        max_players: max_players || 9,
        time_limit: time_limit || 30,
        room_type: room_type || 'cash',
        is_private: is_private || false,
        password: hashedPassword,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// GET /:id - get room details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (roomError || !room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const { data: players, error: playersError } = await supabaseAdmin
      .from('room_players')
      .select('*, profiles(username, avatar_url)')
      .eq('room_id', id);

    if (playersError) {
      res.status(500).json({ error: playersError.message });
      return;
    }

    res.json({ ...room, players: players || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// POST /:id/join - join room
router.post('/:id/join', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { seat_index, buy_in, password } = req.body;

    if (seat_index === undefined || !buy_in) {
      res.status(400).json({ error: 'seat_index and buy_in are required' });
      return;
    }

    // Get room
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (roomError || !room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Check if private room and verify password
    if (room.is_private) {
      if (!password) {
        res.status(403).json({ error: 'Password required for private room' });
        return;
      }
      const valid = await bcrypt.compare(password, room.password);
      if (!valid) {
        res.status(403).json({ error: 'Invalid room password' });
        return;
      }
    }

    // Check buy-in bounds
    if (buy_in < room.min_buy_in || buy_in > room.max_buy_in) {
      res.status(400).json({
        error: `Buy-in must be between ${room.min_buy_in} and ${room.max_buy_in}`,
      });
      return;
    }

    // Check room is not full and seat is not taken
    const { data: existingPlayers } = await supabaseAdmin
      .from('room_players')
      .select('*')
      .eq('room_id', id);

    if ((existingPlayers || []).length >= room.max_players) {
      res.status(400).json({ error: 'Room is full' });
      return;
    }

    const seatTaken = (existingPlayers || []).some(
      (p: any) => p.seat_index === seat_index
    );
    if (seatTaken) {
      res.status(400).json({ error: 'Seat is already taken' });
      return;
    }

    const alreadyInRoom = (existingPlayers || []).some(
      (p: any) => p.user_id === userId
    );
    if (alreadyInRoom) {
      res.status(400).json({ error: 'You are already in this room' });
      return;
    }

    // Deduct buy_in from user's coins
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('coins')
      .eq('id', userId)
      .single();

    if (!profile || profile.coins < buy_in) {
      res.status(400).json({ error: 'Insufficient coins' });
      return;
    }

    const { error: deductError } = await supabaseAdmin
      .from('profiles')
      .update({ coins: profile.coins - buy_in })
      .eq('id', userId);

    if (deductError) {
      res.status(500).json({ error: 'Failed to deduct coins' });
      return;
    }

    // Insert room_player
    const { data: player, error: insertError } = await supabaseAdmin
      .from('room_players')
      .insert({
        room_id: id,
        user_id: userId,
        seat_index,
        chips: buy_in,
      })
      .select()
      .single();

    if (insertError) {
      // Refund coins on failure
      await supabaseAdmin
        .from('profiles')
        .update({ coins: profile.coins })
        .eq('id', userId);
      res.status(400).json({ error: insertError.message });
      return;
    }

    res.status(201).json(player);
  } catch (err) {
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// POST /:id/leave - leave room
router.post('/:id/leave', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // Get player's chips
    const { data: player, error: playerError } = await supabaseAdmin
      .from('room_players')
      .select('chips')
      .eq('room_id', id)
      .eq('user_id', userId)
      .single();

    if (playerError || !player) {
      res.status(404).json({ error: 'You are not in this room' });
      return;
    }

    // Add chips back to user's coins
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('coins')
      .eq('id', userId)
      .single();

    if (profile) {
      await supabaseAdmin
        .from('profiles')
        .update({ coins: profile.coins + player.chips })
        .eq('id', userId);
    }

    // Delete from room_players
    const { error: deleteError } = await supabaseAdmin
      .from('room_players')
      .delete()
      .eq('room_id', id)
      .eq('user_id', userId);

    if (deleteError) {
      res.status(500).json({ error: deleteError.message });
      return;
    }

    res.json({ message: 'Left room successfully', chips_returned: player.chips });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

export default router;
