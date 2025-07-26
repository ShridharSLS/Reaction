-- Add 'team' status to the videos table check constraint
-- First, let's see the current constraint
-- SELECT conname, consrc FROM pg_constraint WHERE conname LIKE '%status%';

-- Drop the existing constraint and recreate it with 'team' status
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_status_check;

-- Add the new constraint that includes 'team' status
ALTER TABLE videos ADD CONSTRAINT videos_status_check 
CHECK (status IN ('relevance', 'pending', 'accepted', 'rejected', 'assigned', 'team'));

-- Verify the constraint was added
SELECT conname, consrc FROM pg_constraint WHERE conname = 'videos_status_check';
