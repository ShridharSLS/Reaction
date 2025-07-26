-- Add video_code column for smart duplicate detection
-- This will store the 11-character unique identifier extracted from YouTube/Instagram URLs

-- Add the new column
ALTER TABLE videos ADD COLUMN video_code VARCHAR(11);

-- Create index for fast duplicate lookups
CREATE INDEX idx_video_code ON videos(video_code);

-- Add unique constraint on video_code (allowing nulls for backward compatibility)
CREATE UNIQUE INDEX idx_video_code_unique ON videos(video_code) WHERE video_code IS NOT NULL;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'videos' AND column_name = 'video_code';
