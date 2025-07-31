-- Fix the status constraint to include 'relevance' as a valid status
-- This resolves the constraint violation when adding new videos

-- Drop the existing constraint
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_status_check;

-- Add the updated constraint that includes 'relevance'
ALTER TABLE videos ADD CONSTRAINT videos_status_check 
CHECK (status IN ('relevance', 'pending', 'accepted', 'rejected', 'assigned'));

-- Update any existing videos that might have null status to 'relevance'
UPDATE videos SET status = 'relevance' WHERE status IS NULL;
