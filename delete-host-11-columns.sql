-- SQL Script to completely remove Host 11 from the database
-- This script will:
-- 1. Drop host-specific columns from the videos table
-- 2. Delete the host record from the hosts table
-- 3. Provide verification queries

-- WARNING: This operation is irreversible. Make sure you have a backup if needed.

-- Step 1: Drop Host 11 specific columns from videos table
ALTER TABLE videos DROP COLUMN IF EXISTS status_11;
ALTER TABLE videos DROP COLUMN IF EXISTS note_11;
ALTER TABLE videos DROP COLUMN IF EXISTS video_id_text_11;

-- Step 2: Delete Host 11 record from hosts table
DELETE FROM hosts WHERE host_id = 11;

-- Step 3: Verification queries
-- Check that Host 11 columns are removed from videos table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND column_name LIKE '%_11';

-- Check that Host 11 is removed from hosts table
SELECT * FROM hosts WHERE host_id = 11;

-- Show remaining hosts
SELECT host_id, name, is_active FROM hosts ORDER BY host_id;

-- Show current videos table structure (optional)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'videos' 
-- ORDER BY ordinal_position;

-- Expected results after running this script:
-- 1. No columns ending with '_11' should exist in videos table
-- 2. No host with host_id = 11 should exist in hosts table
-- 3. Host 11 should be completely removed from the system
