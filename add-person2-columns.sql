-- Add Person 2 columns to videos table
-- This adds status_2, note_2, and video_id_text_2 for the second person workflow

-- Add status_2 column with same constraints as status_1
ALTER TABLE videos ADD COLUMN status_2 TEXT DEFAULT 'relevance' 
CHECK (status_2 IN ('relevance', 'pending', 'accepted', 'rejected', 'assigned'));

-- Add note_2 column for Person 2's notes
ALTER TABLE videos ADD COLUMN note_2 TEXT;

-- Add video_id_text_2 column for Person 2's video ID assignments
ALTER TABLE videos ADD COLUMN video_id_text_2 VARCHAR(255);

-- Add index for performance on status_2 queries
CREATE INDEX IF NOT EXISTS idx_videos_status_2 ON videos(status_2);

-- Add comments for documentation
COMMENT ON COLUMN videos.status_2 IS 'Status for person 2 in multi-person workflow';
COMMENT ON COLUMN videos.note_2 IS 'Notes for person 2 in multi-person workflow';
COMMENT ON COLUMN videos.video_id_text_2 IS 'Video ID assigned by person 2';
