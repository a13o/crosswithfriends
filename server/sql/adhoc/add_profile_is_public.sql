-- Migration: Add profile_is_public to users for profile privacy toggle
-- Run on existing databases. All users default to private (FALSE).

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_is_public BOOLEAN NOT NULL DEFAULT FALSE;
