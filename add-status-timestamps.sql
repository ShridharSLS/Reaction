-- Add status update timestamp columns for each host
-- This migration adds timestamp tracking for when status changes occur

-- Step 1: Add timestamp columns for each host (following host-numbered convention)
ALTER TABLE videos 
ADD COLUMN status_1_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN status_2_updated_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Set initial values for existing records (use created_at as baseline)
UPDATE videos 
SET status_1_updated_at = created_at,
    status_2_updated_at = created_at
WHERE status_1_updated_at IS NULL OR status_2_updated_at IS NULL;

-- Step 3: Create function to automatically update timestamps when status changes
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

-- Step 4: Create trigger to automatically update timestamps
DROP TRIGGER IF EXISTS videos_status_timestamp_trigger ON videos;
CREATE TRIGGER videos_status_timestamp_trigger
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_status_timestamp();

-- Step 5: Add indexes for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_videos_status_1_updated_at ON videos(status_1_updated_at);
CREATE INDEX IF NOT EXISTS idx_videos_status_2_updated_at ON videos(status_2_updated_at);

-- Verification query (uncomment to test after running migration)
-- SELECT id, status_1, status_1_updated_at, status_2, status_2_updated_at, created_at 
-- FROM videos 
-- ORDER BY id DESC 
-- LIMIT 5;
