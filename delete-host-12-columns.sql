-- COMPLETE HOST 12 DELETION SCRIPT
-- This script completely removes all traces of Host 12 from the database
-- Run this script in Supabase SQL Editor

-- Step 1: Remove Host 12's columns from the videos table
ALTER TABLE videos DROP COLUMN IF EXISTS status_12;
ALTER TABLE videos DROP COLUMN IF EXISTS note_12;
ALTER TABLE videos DROP COLUMN IF EXISTS video_id_text_12;

-- Step 2: Permanently delete Host 12 record from hosts table
DELETE FROM hosts WHERE host_id = 12;

-- Step 3: Verification queries (run these to confirm complete deletion)
-- Check that no Host 12 columns remain in videos table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND column_name LIKE '%_12';
-- This should return no results

-- Check that Host 12 record is completely removed from hosts table
SELECT * FROM hosts WHERE host_id = 12;
-- This should return no results

-- Optional: View remaining active hosts to confirm system integrity
SELECT host_id, name, status_column, note_column, video_id_column, is_active 
FROM hosts 
WHERE is_active = true 
ORDER BY host_id;
-- This should show all remaining active hosts without Host 12
