import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const DEFAULT_SETTINGS = {
  auto_rebuy: false,
  show_hand_strength: true,
  allow_spectators: true,
  haptic_feedback: true,
  master_volume: 80,
  sfx_volume: 80,
  music_volume: 50,
  high_frame_rate: false,
  hide_online_status: false,
  reject_stranger_messages: false,
  hide_match_history: false,
};

const ALLOWED_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof typeof DEFAULT_SETTINGS>;

function sanitizeSettings(input: Record<string, unknown>) {
  const sanitized: Record<string, boolean | number> = {};

  for (const key of ALLOWED_SETTING_KEYS) {
    const value = input[key];
    if (value === undefined) continue;

    if (key.endsWith('_volume')) {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        sanitized[key] = Math.max(0, Math.min(100, Math.round(numericValue)));
      }
      continue;
    }

    sanitized[key] = Boolean(value);
  }

  return sanitized as Partial<typeof DEFAULT_SETTINGS>;
}

// GET / - get user settings
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      res.json(data);
      return;
    }

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
  } catch {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT / - update user settings
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const settings = sanitizeSettings(req.body ?? {});

    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          ...DEFAULT_SETTINGS,
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
  } catch {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
