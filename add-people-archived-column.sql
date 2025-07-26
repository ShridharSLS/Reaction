-- Add archived column to people table for archiving functionality
-- This allows hiding people from forms while keeping them in the database

-- Add the archived column (defaults to false for existing people)
ALTER TABLE people ADD COLUMN archived BOOLEAN DEFAULT FALSE;

-- Create index for fast filtering of active/archived people
CREATE INDEX idx_people_archived ON people(archived);

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'people' AND column_name = 'archived';
