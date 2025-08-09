-- Fix Host 1 schema consistency by renaming columns to numbered convention
-- This ensures all hosts follow the same pattern: status_X, video_id_text_X, note_X

-- CRITICAL: This migration fixes the root cause of video ID clearing issues
-- Host 1 was using legacy column names instead of numbered convention

BEGIN;

-- Step 1: Rename Host 1 columns to follow numbered convention
ALTER TABLE videos RENAME COLUMN video_id_text TO video_id_text_1;
ALTER TABLE videos RENAME COLUMN note TO note_1;

-- Step 2: Update the hosts table configuration to reflect new column names
UPDATE hosts 
SET 
    video_id_column = 'video_id_text_1',
    note_column = 'note_1'
WHERE host_id = 1;

-- Step 3: Verify the changes
SELECT 
    host_id, 
    name, 
    status_column, 
    video_id_column, 
    note_column 
FROM hosts 
ORDER BY host_id;

-- Step 4: Show sample data to verify columns exist
SELECT 
    id,
    status_1,
    video_id_text_1,
    note_1,
    status_2,
    video_id_text_2,
    note_2
FROM videos 
LIMIT 3;

COMMIT;

-- IMPORTANT: After running this migration:
-- 1. All hosts will use consistent numbered column naming
-- 2. The video ID clearing functionality should work for all hosts
-- 3. The StatusUpdateService will use correct column names from host config
-- 4. No code changes needed - existing logic will work with corrected schema
