-- Quick update to unified video view with all current video table columns
DROP VIEW IF EXISTS unified_video_view;

CREATE VIEW unified_video_view AS
SELECT 
    -- Core video data (all columns from videos table)
    v.id,
    v.added_by,
    v.link,
    v.type,
    v.link_added_on,
    v.likes_count,
    v.relevance_rating,
    v.score,
    v.status_1,
    v.video_id_text_1 as video_id_1,
    v.created_at,
    v.video_code,
    v.note_1,
    v.is_team,
    v.shridhar_id,
    v.team_id,
    v.status_2,
    v.note_2,
    v.video_id_text_2 as video_id_2,
    v.pitch,
    v.taken_by,
    v.status_3,
    v.note_3,
    v.video_id_text_3 as video_id_3,
    v.status_1_updated_at,
    v.status_2_updated_at,
    v.status_3_updated_at,
    
    -- Person information (lookup)
    COALESCE(p.name, 'Unknown') as added_by_name,
    
    -- Tags information (aggregated)
    COUNT(DISTINCT t.id) as tags_count,
    STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name) as tags_names,
    STRING_AGG(DISTINCT t.color, ', ' ORDER BY t.color) as tags_colors

FROM videos v
LEFT JOIN people p ON v.added_by = p.id
LEFT JOIN video_tags vt ON v.id = vt.video_id
LEFT JOIN tags t ON vt.tag_id = t.id
GROUP BY 
    v.id, v.added_by, v.link, v.type, v.link_added_on, v.likes_count,
    v.relevance_rating, v.score, v.status_1, v.video_id_text_1, v.created_at,
    v.video_code, v.note_1, v.is_team, v.shridhar_id, v.team_id,
    v.status_2, v.note_2, v.video_id_text_2, v.pitch, v.taken_by,
    v.status_3, v.note_3, v.video_id_text_3,
    v.status_1_updated_at, v.status_2_updated_at, v.status_3_updated_at,
    p.name
ORDER BY v.created_at DESC;
