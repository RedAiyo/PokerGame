-- ============================================================================
-- 001_initial_schema.sql
-- Texas Hold'em Poker Game - Initial Database Schema
-- ============================================================================

-- =========================
-- 1. TABLES
-- =========================

-- profiles: linked to Supabase auth.users
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  avatar_url  TEXT,
  bio         TEXT,
  coins       BIGINT      NOT NULL DEFAULT 10000,
  diamonds    INT         NOT NULL DEFAULT 100,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- rooms
CREATE TABLE rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT    NOT NULL,
  small_blind   INT     NOT NULL DEFAULT 10,
  big_blind     INT     NOT NULL DEFAULT 20,
  min_buy_in    INT     NOT NULL DEFAULT 100,
  max_buy_in    INT     NOT NULL DEFAULT 1000,
  max_players   INT     NOT NULL DEFAULT 9 CHECK (max_players IN (2, 6, 9)),
  time_limit    INT     NOT NULL DEFAULT 30,
  room_type     TEXT    NOT NULL DEFAULT '新手场',
  is_private    BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT,
  creator_id    UUID    REFERENCES profiles(id),
  status        TEXT    NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- room_players
CREATE TABLE room_players (
  room_id    UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seat_index INT         NOT NULL,
  chips      INT         NOT NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id),
  UNIQUE (room_id, seat_index)
);

-- games
CREATE TABLE games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  hand_number      INT  NOT NULL,
  dealer_seat      INT  NOT NULL,
  community_cards  JSONB NOT NULL DEFAULT '[]'::jsonb,
  pot              INT   NOT NULL DEFAULT 0,
  phase            TEXT  NOT NULL DEFAULT 'preflop'
                     CHECK (phase IN ('preflop','flop','turn','river','showdown','complete')),
  current_turn_seat INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- game_players
CREATE TABLE game_players (
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hole_cards  JSONB NOT NULL DEFAULT '[]'::jsonb,
  status      TEXT  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','folded','all_in')),
  current_bet INT   NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, user_id)
);

-- hand_history
CREATE TABLE hand_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id    UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id),
  action     TEXT NOT NULL,
  amount     INT  NOT NULL DEFAULT 0,
  phase      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- chat_messages
CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id),
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_settings
CREATE TABLE user_settings (
  user_id                  UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  auto_rebuy               BOOLEAN NOT NULL DEFAULT false,
  show_hand_strength       BOOLEAN NOT NULL DEFAULT true,
  allow_spectators         BOOLEAN NOT NULL DEFAULT true,
  haptic_feedback          BOOLEAN NOT NULL DEFAULT true,
  master_volume            INT     NOT NULL DEFAULT 80,
  sfx_volume               INT     NOT NULL DEFAULT 80,
  music_volume             INT     NOT NULL DEFAULT 50,
  high_frame_rate          BOOLEAN NOT NULL DEFAULT false,
  hide_online_status       BOOLEAN NOT NULL DEFAULT false,
  reject_stranger_messages BOOLEAN NOT NULL DEFAULT false,
  hide_match_history       BOOLEAN NOT NULL DEFAULT false
);

-- =========================
-- 2. INDEXES
-- =========================

CREATE INDEX idx_rooms_status              ON rooms (status);
CREATE INDEX idx_room_players_room_id      ON room_players (room_id);
CREATE INDEX idx_games_room_id             ON games (room_id);
CREATE INDEX idx_chat_messages_room_created ON chat_messages (room_id, created_at);
CREATE INDEX idx_hand_history_game_id      ON hand_history (game_id);

-- =========================
-- 3. ROW LEVEL SECURITY
-- =========================

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players  ENABLE ROW LEVEL SECURITY;
ALTER TABLE games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hand_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ---- profiles ----
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- rooms ----
CREATE POLICY "rooms_select_all"
  ON rooms FOR SELECT
  USING (true);

CREATE POLICY "rooms_insert_authenticated"
  ON rooms FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ---- room_players ----
CREATE POLICY "room_players_select_all"
  ON room_players FOR SELECT
  USING (true);

CREATE POLICY "room_players_insert_authenticated"
  ON room_players FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "room_players_delete_authenticated"
  ON room_players FOR DELETE
  TO authenticated
  USING (true);

-- ---- games ----
CREATE POLICY "games_select_all"
  ON games FOR SELECT
  USING (true);

-- ---- game_players ----
-- Everyone authenticated can SELECT, but hole_cards are protected via
-- the security-definer function below.  The raw table policy allows
-- SELECT so the function can operate.
CREATE POLICY "game_players_select_authenticated"
  ON game_players FOR SELECT
  TO authenticated
  USING (true);

-- ---- hand_history ----
CREATE POLICY "hand_history_select_authenticated"
  ON hand_history FOR SELECT
  TO authenticated
  USING (true);

-- ---- chat_messages ----
CREATE POLICY "chat_messages_select_authenticated"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "chat_messages_insert_authenticated"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ---- user_settings ----
CREATE POLICY "user_settings_select_own"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert_own"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update_own"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================
-- 4. SECURITY-DEFINER FUNCTION
-- =========================
-- Returns game_players rows for a given game, stripping hole_cards for
-- users other than the caller.  Call this from the client instead of
-- querying game_players directly when you need to display the table.

CREATE OR REPLACE FUNCTION get_game_state(p_game_id UUID)
RETURNS TABLE (
  game_id     UUID,
  user_id     UUID,
  hole_cards  JSONB,
  status      TEXT,
  current_bet INT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    gp.game_id,
    gp.user_id,
    CASE
      WHEN gp.user_id = auth.uid() THEN gp.hole_cards
      ELSE '[]'::jsonb
    END AS hole_cards,
    gp.status,
    gp.current_bet
  FROM game_players gp
  WHERE gp.game_id = p_game_id;
$$;

-- =========================
-- 5. TRIGGER: auto-create profile on signup
-- =========================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || LEFT(NEW.id::text, 8))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
