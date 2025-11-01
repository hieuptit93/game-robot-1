-- GAME SESSIONS
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  age INTEGER,
  game_id INTEGER,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  level_of_liking TEXT,
  difficuly TEXT,
  number_of_replays INTEGER,
  score INTEGER DEFAULT 0,
  comment TEXT,
  survey_completed BOOLEAN DEFAULT FALSE,
  exited_via_button BOOLEAN DEFAULT FALSE,
  next_game_id INTEGER,
  profile_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_start_time ON game_sessions(start_time);

-- Auto-update updated_at using the common helper
CREATE TRIGGER update_game_sessions_updated_at 
  BEFORE UPDATE ON game_sessions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "game_sessions_public_select" ON game_sessions;
DROP POLICY IF EXISTS "game_sessions_public_insert" ON game_sessions;
DROP POLICY IF EXISTS "game_sessions_public_update" ON game_sessions;

-- Public (unauthenticated) access for read/insert/update
CREATE POLICY "game_sessions_public_select" ON game_sessions
  FOR SELECT USING (true);

CREATE POLICY "game_sessions_public_insert" ON game_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "game_sessions_public_update" ON game_sessions
  FOR UPDATE USING (true) WITH CHECK (true);

COMMENT ON TABLE game_sessions IS 'Tracks per-game play sessions and user feedback/metadata';

