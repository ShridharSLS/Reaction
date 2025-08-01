-- Add pitch column to videos table
-- This allows users to submit their own notes/pitch when adding video topics

ALTER TABLE videos 
ADD COLUMN pitch TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN videos.pitch IS 'User-submitted pitch/note explaining why this video topic would be valuable';
