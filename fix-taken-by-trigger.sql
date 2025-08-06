-- Fix the taken_by trigger to prevent recursion
-- Only update taken_by when status columns change, not when taken_by itself changes

-- Drop the old trigger
DROP TRIGGER IF EXISTS update_taken_by_trigger ON videos;

-- Create a new trigger function with recursion prevention
CREATE OR REPLACE FUNCTION trigger_update_taken_by()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if this is not a recursion caused by updating taken_by itself
    -- Check if taken_by is the ONLY column being updated
    IF (TG_OP = 'UPDATE' AND 
        OLD.taken_by IS DISTINCT FROM NEW.taken_by AND
        -- Check if host status columns are unchanged
        (
            (OLD.status_1 IS NOT DISTINCT FROM NEW.status_1) AND
            (OLD.status_2 IS NOT DISTINCT FROM NEW.status_2) AND
            -- Add checks for additional host status columns as needed
            -- Example: (OLD.status_3 IS NOT DISTINCT FROM NEW.status_3) AND
            -- If you have too many hosts to list explicitly, you could skip this check
            -- and use a different approach
            TRUE
        )) THEN
        -- If only taken_by changed, don't trigger recursion
        RETURN NEW;
    END IF;
    
    -- If we reach here, it means a status column was updated (not just taken_by)
    -- Safe to update the taken_by count
    PERFORM update_taken_by(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger with the improved function
CREATE TRIGGER update_taken_by_trigger
    AFTER UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_taken_by();

-- Comment for review
-- This updated trigger prevents infinite recursion by checking:
-- 1. If taken_by is being changed
-- 2. If no status columns are being changed
-- If ONLY taken_by is changing, it skips the update to avoid recursion
