-- Rename status column to status_1 to prepare for multi-person workflow
-- This allows adding status_2, status_3, etc. for different people

-- First, drop the existing constraint
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_status_check;

-- Rename the status column to status_1
ALTER TABLE videos RENAME COLUMN status TO status_1;

-- Add the constraint back with the new column name
ALTER TABLE videos ADD CONSTRAINT videos_status_1_check 
CHECK (status_1 IN ('relevance', 'pending', 'accepted', 'rejected', 'assigned'));

-- Set default value for status_1 column
ALTER TABLE videos ALTER COLUMN status_1 SET DEFAULT 'relevance';

-- Optional: Add comment to document the purpose
COMMENT ON COLUMN videos.status_1 IS 'Status for person 1 in multi-person workflow';
