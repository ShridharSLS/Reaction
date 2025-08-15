-- ===== UNIFIED VIDEO VIEW CREATION =====
-- Creates a comprehensive SQL view that joins all video data with person names and tags
-- This view provides a single source of truth for all video-related data
-- Perfect for exports, reporting, and Google Sheets synchronization

-- Drop the view if it exists (for re-running the script)
DROP VIEW IF EXISTS unified_video_view;

-- Create the unified view with all video data, person names, and tags
CREATE VIEW unified_video_view AS
SELECT 
    -- Core video data
    v.id,
    v.link,
    v.video_code,
    v.type,
    v.likes_count,
    v.pitch,
    v.relevance_rating,
    v.score,
    v.taken_by,
    v.created_at,
    v.link_added_on,
    
    -- Additional core columns from videos table
    v.is_team,
    v.shridhar_id,
    v.team_id,
    
    -- Person information
    v.added_by as added_by_id,
    COALESCE(p.name, 'Unknown') as added_by_name,
    
    -- Host-specific status columns (all hosts)
    v.status_1,
    v.status_2,
    v.status_3,
    
    -- Host-specific note columns (all hosts - updated to match actual schema)
    v.note_1,
    v.note_2,
    v.note_3,
    
    -- Host-specific video ID columns (all hosts - updated to match actual schema)
    v.video_id_text_1 as video_id_1,
    v.video_id_text_2 as video_id_2,
    v.video_id_text_3 as video_id_3,
    
    -- Status timestamp columns (all hosts)
    v.status_1_updated_at,
    v.status_2_updated_at,
    v.status_3_updated_at,
    
    -- Tags information (aggregated)
    COUNT(DISTINCT t.id) as tags_count,
    STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name) as tags_names,
    STRING_AGG(DISTINCT t.color, ', ' ORDER BY t.color) as tags_colors,
    
    -- Additional computed fields for analysis
    CASE 
        WHEN v.relevance_rating = -1 THEN 'Unrated'
        WHEN v.relevance_rating = 0 THEN 'Not Relevant'
        WHEN v.relevance_rating = 1 THEN 'Somewhat Relevant'
        WHEN v.relevance_rating = 2 THEN 'Relevant'
        WHEN v.relevance_rating = 3 THEN 'Highly Relevant'
        ELSE 'Unknown'
    END as relevance_label,
    
    -- Host status summary (for quick analysis)
    CONCAT_WS(' | ', 
        CASE WHEN v.status_1 IS NOT NULL THEN CONCAT('H1:', v.status_1) END,
        CASE WHEN v.status_2 IS NOT NULL THEN CONCAT('H2:', v.status_2) END,
        CASE WHEN v.status_3 IS NOT NULL THEN CONCAT('H3:', v.status_3) END
    ) as host_status_summary,
    
    -- Days since creation (for aging analysis)
    EXTRACT(DAY FROM (NOW() - v.created_at)) as days_since_created,
    
    -- Video URL domain extraction (for source analysis)
    CASE 
        WHEN v.link LIKE '%youtube.com%' OR v.link LIKE '%youtu.be%' THEN 'YouTube'
        WHEN v.link LIKE '%vimeo.com%' THEN 'Vimeo'
        WHEN v.link LIKE '%tiktok.com%' THEN 'TikTok'
        WHEN v.link LIKE '%instagram.com%' THEN 'Instagram'
        ELSE 'Other'
    END as video_platform

FROM videos v
LEFT JOIN people p ON v.added_by = p.id
LEFT JOIN video_tags vt ON v.id = vt.video_id
LEFT JOIN tags t ON vt.tag_id = t.id
GROUP BY 
    v.id, v.link, v.video_code, v.type, v.likes_count, v.pitch, 
    v.relevance_rating, v.score, v.taken_by, v.created_at, v.link_added_on,
    v.is_team, v.shridhar_id, v.team_id,
    v.added_by, p.name,
    v.status_1, v.status_2, v.status_3,
    v.note_1, v.note_2, v.note_3,
    v.video_id_text_1, v.video_id_text_2, v.video_id_text_3,
    v.status_1_updated_at, v.status_2_updated_at, v.status_3_updated_at
ORDER BY v.created_at DESC;

-- Create an index on the view for better performance (if supported)
-- Note: Some databases don't support indexes on views, but we can create them on the underlying tables
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_added_by ON videos(added_by);
CREATE INDEX IF NOT EXISTS idx_video_tags_video_id ON video_tags(video_id);
CREATE INDEX IF NOT EXISTS idx_video_tags_tag_id ON video_tags(tag_id);

-- Grant appropriate permissions (adjust as needed for your setup)
-- GRANT SELECT ON unified_video_view TO authenticated;
-- GRANT SELECT ON unified_video_view TO service_role;

-- Verification query to test the view
-- SELECT COUNT(*) as total_records FROM unified_video_view;
-- SELECT * FROM unified_video_view LIMIT 5;

COMMENT ON VIEW unified_video_view IS 'Comprehensive view joining all video data with person names and tags. Includes computed fields for analysis and reporting. Perfect for exports and Google Sheets synchronization.';
