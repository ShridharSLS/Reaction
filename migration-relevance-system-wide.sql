-- =====================================================
-- MIGRATION: System-Wide Relevance Status
-- Purpose: Make relevance status system-wide instead of host-specific
-- Date: 2025-08-01
-- =====================================================

-- Step 1: Rename and modify the obsolete is_shridhar column to relevance_status
-- (This repurposes an unused boolean column to a varchar column)
ALTER TABLE videos 
ALTER COLUMN is_shridhar TYPE VARCHAR(20),
ALTER COLUMN is_shridhar SET DEFAULT NULL;

-- Rename the column to relevance_status
ALTER TABLE videos 
RENAME COLUMN is_shridhar TO relevance_status;

-- Step 2: Set system-wide relevance status for videos that currently have relevance_rating = -1
-- These are videos that need relevance rating
UPDATE videos 
SET relevance_status = 'relevance' 
WHERE relevance_rating = -1;

-- Step 3: Clear relevance status from all host-specific status columns
-- This removes 'relevance' from status_1, status_2, status_11, etc.
UPDATE videos 
SET status_1 = NULL 
WHERE status_1 = 'relevance';

UPDATE videos 
SET status_2 = NULL 
WHERE status_2 = 'relevance';

UPDATE videos 
SET status_11 = NULL 
WHERE status_11 = 'relevance';

-- Step 4: For videos that have been rated (relevance_rating 0-3), 
-- set them to 'pending' in ALL active host status columns
UPDATE videos 
SET status_1 = 'pending',
    status_2 = 'pending',
    status_11 = 'pending'
WHERE relevance_rating >= 0 
  AND relevance_rating <= 3 
  AND relevance_status IS NULL;

-- Step 5: Create index on the new relevance_status column for performance
CREATE INDEX IF NOT EXISTS idx_videos_relevance_status ON videos(relevance_status);

-- Step 6: Verify migration results
SELECT 
    'Migration Results' as info,
    COUNT(*) FILTER (WHERE relevance_status = 'relevance') as videos_in_relevance,
    COUNT(*) FILTER (WHERE status_1 = 'pending') as host1_pending,
    COUNT(*) FILTER (WHERE status_2 = 'pending') as host2_pending,
    COUNT(*) FILTER (WHERE status_11 = 'pending') as host11_pending,
    COUNT(*) FILTER (WHERE relevance_rating = -1) as unrated_videos,
    COUNT(*) FILTER (WHERE relevance_rating >= 0 AND relevance_rating <= 3) as rated_videos
FROM videos;
