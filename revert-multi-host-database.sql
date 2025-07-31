-- Revert multi-host database changes back to original schema
-- This script undoes the changes made by add-multi-host-support.sql

-- First, rename Shridhar columns back to original names
ALTER TABLE videos RENAME COLUMN shridhar_status TO status;
ALTER TABLE videos RENAME COLUMN shridhar_note TO note;
ALTER TABLE videos RENAME COLUMN shridhar_video_id TO video_id_text;

-- Drop Vidushi-specific columns
ALTER TABLE videos DROP COLUMN IF EXISTS vidushi_status;
ALTER TABLE videos DROP COLUMN IF EXISTS vidushi_note;
ALTER TABLE videos DROP COLUMN IF EXISTS vidushi_video_id;

-- Restore the original status column constraint (including 'relevance')
-- The original system always included 'relevance' as a valid status
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE videos ADD CONSTRAINT videos_status_check CHECK (status IN ('relevance', 'pending', 'accepted', 'rejected', 'assigned'));

-- Update any null status values to 'pending' (safety measure)
UPDATE videos SET status = 'pending' WHERE status IS NULL;

-- Note: This revert script assumes all data in shridhar_* columns should be preserved
-- as the main data, and Vidushi-specific data will be lost. If you need to preserve
-- any Vidushi-specific data, please modify this script accordingly before running.
