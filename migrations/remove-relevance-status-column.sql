-- Migration script to remove the redundant relevance_status column
-- This script should be run after ensuring all code now uses relevance_rating instead

-- First, verify there are no critical dependencies on relevance_status
-- Check for any videos that might have inconsistent state
SELECT 
  id, 
  relevance_rating, 
  relevance_status
FROM 
  videos
WHERE 
  (relevance_rating = -1 AND relevance_status != 'relevance') OR
  (relevance_rating = 0 AND relevance_status != 'trash') OR
  (relevance_rating > 0 AND relevance_status IS NOT NULL);

-- If the above query returns no rows, we can safely proceed with the removal
-- Otherwise, we should fix the inconsistencies first

-- Safe removal of the relevance_status column
ALTER TABLE videos DROP COLUMN relevance_status;

-- Document the schema change in a comment
COMMENT ON TABLE videos IS 'Video topics table. relevance_status column has been removed; use relevance_rating instead (-1 for relevance view, 0 for trash view, 1-3 for host-specific pending)';
