-- Simple fix: Just update the status constraint to include 'relevance'
-- This assumes the database is already in the original state with columns: status, note, video_id_text

-- Drop the existing constraint and add the correct one with 'relevance' included
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE videos ADD CONSTRAINT videos_status_check 
CHECK (status IN ('relevance', 'pending', 'accepted', 'rejected', 'assigned'));

-- Set default value for status column to 'relevance' (matching original schema)
ALTER TABLE videos ALTER COLUMN status SET DEFAULT 'relevance';
