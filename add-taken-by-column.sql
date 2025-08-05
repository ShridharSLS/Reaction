-- Add taken_by column to videos table
-- This column counts how many hosts have "taken on" a video (accepted or ID given status)

-- Step 1: Add the taken_by column
ALTER TABLE videos ADD COLUMN taken_by INTEGER DEFAULT 0;

-- Step 2: Create function to calculate taken_by count for a video
CREATE OR REPLACE FUNCTION calculate_taken_by(video_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    host_record RECORD;
    taken_count INTEGER := 0;
    status_value TEXT;
BEGIN
    -- Loop through all hosts to check their status for this video
    FOR host_record IN 
        SELECT host_id, status_column 
        FROM hosts 
        WHERE is_active = true
    LOOP
        -- Get the status value for this host and video
        EXECUTE format('SELECT %I FROM videos WHERE id = $1', host_record.status_column) 
        INTO status_value 
        USING video_id;
        
        -- Count if status is 'accepted' or 'assigned' (ID given)
        IF status_value IN ('accepted', 'assigned') THEN
            taken_count := taken_count + 1;
        END IF;
    END LOOP;
    
    RETURN taken_count;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create function to update taken_by for a specific video
CREATE OR REPLACE FUNCTION update_taken_by(video_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE videos 
    SET taken_by = calculate_taken_by(video_id)
    WHERE id = video_id;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create function to update taken_by for all videos
CREATE OR REPLACE FUNCTION update_all_taken_by()
RETURNS VOID AS $$
DECLARE
    video_record RECORD;
BEGIN
    FOR video_record IN SELECT id FROM videos LOOP
        PERFORM update_taken_by(video_record.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Update all existing videos with correct taken_by counts
SELECT update_all_taken_by();

-- Step 6: Create trigger function to automatically update taken_by when host statuses change
CREATE OR REPLACE FUNCTION trigger_update_taken_by()
RETURNS TRIGGER AS $$
BEGIN
    -- Update taken_by count for the affected video
    PERFORM update_taken_by(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to automatically update taken_by on status changes
DROP TRIGGER IF EXISTS update_taken_by_trigger ON videos;
CREATE TRIGGER update_taken_by_trigger
    AFTER UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_taken_by();

-- Step 8: Add index for performance
CREATE INDEX IF NOT EXISTS idx_videos_taken_by ON videos(taken_by);

-- Verification query to check the results
SELECT 
    id,
    link,
    taken_by,
    status_1,
    status_2,
    (CASE WHEN status_1 IN ('accepted', 'assigned') THEN 1 ELSE 0 END +
     CASE WHEN status_2 IN ('accepted', 'assigned') THEN 1 ELSE 0 END) as manual_count
FROM videos 
WHERE taken_by > 0
ORDER BY taken_by DESC, id
LIMIT 10;
