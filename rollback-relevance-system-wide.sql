-- =====================================================
-- ROLLBACK SCRIPT: System-Wide Relevance Status
-- Purpose: Revert the system-wide relevance changes back to host-specific
-- Date: 2025-08-01
-- WARNING: This will restore the previous host-specific relevance system
-- =====================================================

-- Step 1: Restore relevance status to host-specific columns for unrated videos
-- Videos with relevance_status = 'relevance' should go back to status_1 = 'relevance'
UPDATE videos 
SET status_1 = 'relevance'
WHERE relevance_status = 'relevance';

-- Step 2: Remove pending status from host columns for videos that were migrated
-- (This is tricky - we'll only remove pending for videos that have relevance_rating >= 0)
-- and set them back to their original host-specific relevance status
UPDATE videos 
SET status_1 = 'relevance',
    status_2 = 'relevance', 
    status_11 = 'relevance'
WHERE relevance_rating >= 0 
  AND relevance_rating <= 3 
  AND relevance_status IS NULL
  AND status_1 = 'pending'
  AND status_2 = 'pending'
  AND status_11 = 'pending';

-- Step 3: Drop the index we created
DROP INDEX IF EXISTS idx_videos_relevance_status;

-- Step 4: Rename relevance_status back to is_shridhar and convert to boolean
ALTER TABLE videos 
RENAME COLUMN relevance_status TO is_shridhar;

-- Convert back to boolean type (this will set all values to NULL/false)
ALTER TABLE videos 
ALTER COLUMN is_shridhar TYPE BOOLEAN USING (is_shridhar = 'true'),
ALTER COLUMN is_shridhar SET DEFAULT FALSE;

-- Step 5: Verify rollback results
SELECT 
    'Rollback Results' as info,
    COUNT(*) FILTER (WHERE status_1 = 'relevance') as host1_relevance,
    COUNT(*) FILTER (WHERE status_2 = 'relevance') as host2_relevance,
    COUNT(*) FILTER (WHERE status_11 = 'relevance') as host11_relevance,
    COUNT(*) FILTER (WHERE is_shridhar IS NOT NULL) as is_shridhar_values,
    COUNT(*) FILTER (WHERE relevance_rating = -1) as unrated_videos
FROM videos;

-- Note: This rollback script assumes the migration was the last change made.
-- If other changes were made after the migration, this rollback may not be complete.
-- Manual verification and adjustment may be required.
