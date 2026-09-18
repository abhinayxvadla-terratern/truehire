-- Migration: Add 30-minute timer columns to dt_attempts
ALTER TABLE dt_attempts
ADD COLUMN IF NOT EXISTS time_limit_seconds integer DEFAULT 1800;

ALTER TABLE dt_attempts
ADD COLUMN IF NOT EXISTS timer_expires_at timestamptz DEFAULT null;

ALTER TABLE dt_attempts
ADD COLUMN IF NOT EXISTS auto_submitted boolean DEFAULT false;