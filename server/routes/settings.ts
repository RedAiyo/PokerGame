import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const DEFAULT_SETTINGS = {
  sound_enabled: true,
  music_enabled: true,
  sound_volume: 0.7,
  music_volume: 0.5,
  notification_enabled: true,
  auto_muck_losing_hand: true,
  show_hand_strength: false,
  four_color_deck: false,
  table_theme: 'green',
  card_back: 'classic',
  language: 'en',
};

// GET / - get user settings
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Create default settings if not found
      const { data: newSettings, error: insertError } = await supabaseAdmin
        .from('user_settings')
        .insert({
          user_id: userId,
          ...DEFAULT_SETTINGS,
        })
        .select()
        .single();

      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }

      res.json(newSettings);
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT / - update user settings
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const settings = req.body;

    // Remove fields that should not be directly set
    delete settings.id;
    delete settings.user_id;
    delete settings.created_at;
    settings.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          ...settings,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
