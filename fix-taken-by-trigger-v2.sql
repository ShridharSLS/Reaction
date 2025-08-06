-- Optimized fix for taken_by trigger to prevent recursion and improve performance
-- This version is much simpler and more efficient

-- Drop the old trigger completely
DROP TRIGGER IF EXISTS update_taken_by_trigger ON videos;

-- Create a much simpler trigger function that only fires on status column changes
CREATE OR REPLACE FUNCTION trigger_update_taken_by()
RETURNS TRIGGER AS $$
DECLARE
    status_changed BOOLEAN := FALSE;
BEGIN
    -- Only check if any status columns actually changed
    -- This prevents recursion when only taken_by is updated
    IF (TG_OP = 'UPDATE') THEN
        -- Check if any status column changed (add more status columns as needed)
        IF (OLD.status_1 IS DISTINCT FROM NEW.status_1) OR
           (OLD.status_2 IS DISTINCT FROM NEW.status_2) THEN
            status_changed := TRUE;
        END IF;
        
        -- If no status columns changed, skip the update
        IF NOT status_changed THEN
            RETURN NEW;
        END IF;
    END IF;
    
    -- Only update taken_by if a status column actually changed
    -- Use a direct calculation instead of calling the function for better performance
    UPDATE videos 
    SET taken_by = (
        CASE WHEN status_1 IN ('accepted', 'assigned') THEN 1 ELSE 0 END +
        CASE WHEN status_2 IN ('accepted', 'assigned') THEN 1 ELSE 0 END
        -- Add more status columns here as needed:
        -- + CASE WHEN status_3 IN ('accepted', 'assigned') THEN 1 ELSE 0 END
    )
    WHERE id = NEW.id AND taken_by != (
        CASE WHEN NEW.status_1 IN ('accepted', 'assigned') THEN 1 ELSE 0 END +
        CASE WHEN NEW.status_2 IN ('accepted', 'assigned') THEN 1 ELSE 0 END
        -- Add more status columns here as needed:
        -- + CASE WHEN NEW.status_3 IN ('accepted', 'assigned') THEN 1 ELSE 0 END
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger with the optimized function
CREATE TRIGGER update_taken_by_trigger
    AFTER UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_taken_by();

-- Comment: This optimized version:
-- 1. Only fires when status columns actually change (prevents recursion)
-- 2. Uses direct SQL calculation instead of function calls (better performance)
-- 3. Only updates if the calculated value is different (avoids unnecessary writes)
