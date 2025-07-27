-- Add note column to videos table for accept/reject notes
ALTER TABLE videos ADD COLUMN note TEXT;

-- Add index for note column for better performance
CREATE INDEX idx_videos_note ON videos(note);
