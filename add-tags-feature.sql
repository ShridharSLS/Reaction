-- Add tags feature to the Video Topic Review System
-- This creates a tags table and video-tag relationship

-- Create tags table for predefined tags
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff', -- Hex color for tag display
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create video_tags junction table for many-to-many relationship
CREATE TABLE video_tags (
    id SERIAL PRIMARY KEY,
    video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(video_id, tag_id) -- Prevent duplicate tag assignments
);

-- Add indexes for performance
CREATE INDEX idx_video_tags_video_id ON video_tags(video_id);
CREATE INDEX idx_video_tags_tag_id ON video_tags(tag_id);
CREATE INDEX idx_tags_name ON tags(name);

-- Insert some sample tags to get started
INSERT INTO tags (name, color) VALUES 
    ('Important', '#dc3545'),
    ('Review Later', '#ffc107'),
    ('High Priority', '#fd7e14'),
    ('Educational', '#28a745'),
    ('Entertainment', '#6f42c1'),
    ('Trending Topic', '#20c997');

-- Add a comment for reference
COMMENT ON TABLE tags IS 'Predefined tags that can be assigned to videos';
COMMENT ON TABLE video_tags IS 'Many-to-many relationship between videos and tags';
