-- Complete fix for status timestamp columns and triggers for ALL hosts
-- This completely removes old functions/triggers and creates new ones with correct column names
-- Updated to include Host 3 (status_3_updated_at)

-- Step 1: Drop ALL existing triggers and functions (clean slate)
DROP TRIGGER IF EXISTS videos_status_timestamp_trigger ON videos;
DROP FUNCTION IF EXISTS update_status_timestamp() CASCADE;

-- Step 2: Drop existing incorrectly named columns if they exist
ALTER TABLE videos DROP COLUMN IF EXISTS shridhar_status_updated_at;
ALTER TABLE videos DROP COLUMN IF EXISTS vidushi_status_updated_at;

-- Step 3: Add correctly named timestamp columns for ALL hosts (1, 2, and 3)
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS status_1_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status_2_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status_3_updated_at TIMESTAMP WITH TIME ZONE;

-- Step 4: Set initial values for existing records (use created_at as baseline)
UPDATE videos 
SET status_1_updated_at = created_at,
    status_2_updated_at = created_at,
    status_3_updated_at = created_at
WHERE status_1_updated_at IS NULL 
   OR status_2_updated_at IS NULL 
   OR status_3_updated_at IS NULL;

-- Step 5: Create NEW function with correct column names for ALL hosts
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
  
  -- Check if status_3 changed (Host 3)
  IF OLD.status_3 IS DISTINCT FROM NEW.status_3 THEN
    NEW.status_3_updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to automatically update timestamps
CREATE TRIGGER videos_status_timestamp_trigger
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_status_timestamp();

-- Step 7: Add indexes for better performance on timestamp queries
CREATE INDEX IF NOT EXISTS idx_videos_status_1_updated_at ON videos(status_1_updated_at);
CREATE INDEX IF NOT EXISTS idx_videos_status_2_updated_at ON videos(status_2_updated_at);
CREATE INDEX IF NOT EXISTS idx_videos_status_3_updated_at ON videos(status_3_updated_at);

-- Step 8: Verify the setup
DO $$
BEGIN
  -- Check if all columns exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'status_1_updated_at') THEN
    RAISE EXCEPTION 'status_1_updated_at column was not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'status_2_updated_at') THEN
    RAISE EXCEPTION 'status_2_updated_at column was not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'status_3_updated_at') THEN
    RAISE EXCEPTION 'status_3_updated_at column was not created';
  END IF;
  
  -- Check if trigger exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'videos_status_timestamp_trigger') THEN
    RAISE EXCEPTION 'videos_status_timestamp_trigger was not created';
  END IF;
  
  RAISE NOTICE 'SUCCESS: All timestamp columns and triggers created successfully for Hosts 1, 2, and 3!';
END $$;
