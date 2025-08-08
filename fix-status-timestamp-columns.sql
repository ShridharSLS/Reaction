-- Fix status timestamp columns to use proper host-numbered naming convention
-- This corrects the column names from shridhar_status_updated_at/vidushi_status_updated_at 
-- to status_1_updated_at/status_2_updated_at to follow the dynamic naming pattern

-- Step 1: Drop existing incorrectly named columns if they exist
ALTER TABLE videos DROP COLUMN IF EXISTS shridhar_status_updated_at;
ALTER TABLE videos DROP COLUMN IF EXISTS vidushi_status_updated_at;

-- Step 2: Add correctly named timestamp columns
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS status_1_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status_2_updated_at TIMESTAMP WITH TIME ZONE;

-- Step 3: Set initial values for existing records (use created_at as baseline)
UPDATE videos 
SET status_1_updated_at = created_at,
    status_2_updated_at = created_at
WHERE status_1_updated_at IS NULL OR status_2_updated_at IS NULL;

-- Step 4: Drop existing trigger and function
DROP TRIGGER IF EXISTS videos_status_timestamp_trigger ON videos;
DROP FUNCTION IF EXISTS update_status_timestamp();

-- Step 5: Create corrected function to automatically update timestamps when status changes
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

-- Step 6: Create trigger to automatically update timestamps
CREATE TRIGGER videos_status_timestamp_trigger
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_status_timestamp();

-- Step 7: Add indexes for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_videos_status_1_updated_at ON videos(status_1_updated_at);
CREATE INDEX IF NOT EXISTS idx_videos_status_2_updated_at ON videos(status_2_updated_at);

-- Step 8: Drop old indexes if they exist
DROP INDEX IF EXISTS idx_videos_shridhar_status_updated_at;
DROP INDEX IF EXISTS idx_videos_vidushi_status_updated_at;

-- Verification query (uncomment to test after running migration)
-- SELECT id, status_1, status_1_updated_at, status_2, status_2_updated_at, created_at 
-- FROM videos 
-- ORDER BY id DESC 
-- LIMIT 5;
