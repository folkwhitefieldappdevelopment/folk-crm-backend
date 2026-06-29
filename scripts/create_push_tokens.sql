CREATE TABLE IF NOT EXISTS push_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'expo',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens ("userId");
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens (token);
