-- Complete fix for status timestamp columns and triggers
-- This completely removes old functions/triggers and creates new ones with correct column names

-- Step 1: Drop ALL existing triggers and functions (clean slate)
DROP TRIGGER IF EXISTS videos_status_timestamp_trigger ON videos;
DROP FUNCTION IF EXISTS update_status_timestamp() CASCADE;

-- Step 2: Drop existing incorrectly named columns if they exist
ALTER TABLE videos DROP COLUMN IF EXISTS shridhar_status_updated_at;
ALTER TABLE videos DROP COLUMN IF EXISTS vidushi_status_updated_at;

-- Step 3: Add correctly named timestamp columns
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS status_1_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status_2_updated_at TIMESTAMP WITH TIME ZONE;

-- Step 4: Set initial values for existing records (use created_at as baseline)
UPDATE videos 
SET status_1_updated_at = created_at,
    status_2_updated_at = created_at
WHERE status_1_updated_at IS NULL OR status_2_updated_at IS NULL;

-- Step 5: Create NEW function with correct column names
CREATE OR REPLACE FUNCTION update_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status_1 changed (Host 1)
  IF OLD.status_1 IS DISTINCT FROM NEW.status_1 THEN
    NEW.status_1_updated_at = NOW();
  END IF;
  
  -- Check if status_2 changed (Host 2)
  IF OLD.status_2 IS DISTINCT FROM NEW.status_2 THEN
    NEW.status_2_updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create NEW trigger
CREATE TRIGGER videos_status_timestamp_trigger
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_status_timestamp();

-- Step 7: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_status_1_updated_at ON videos(status_1_updated_at);
CREATE INDEX IF NOT EXISTS idx_videos_status_2_updated_at ON videos(status_2_updated_at);

-- Step 8: Drop old indexes if they exist
DROP INDEX IF EXISTS idx_videos_shridhar_status_updated_at;
DROP INDEX IF EXISTS idx_videos_vidushi_status_updated_at;

-- Verification query - Test the trigger works
-- UPDATE videos SET status_1 = 'accepted' WHERE id = (SELECT id FROM videos LIMIT 1);
-- SELECT id, status_1, status_1_updated_at, status_2, status_2_updated_at, created_at 
-- FROM videos 
-- ORDER BY status_1_updated_at DESC NULLS LAST
-- LIMIT 3;
