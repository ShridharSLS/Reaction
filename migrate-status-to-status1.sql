-- Migrate existing status data to status_1 and status_2 columns
-- This script handles the migration with special logic for 'assigned' status

-- First, let's check if there's still an old 'status' column
-- If it exists, copy its data to status_1
DO $$
BEGIN
    -- Check if the old 'status' column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status') THEN
        
        -- Copy data from old 'status' column to 'status_1'
        UPDATE videos 
        SET status_1 = status 
        WHERE status IS NOT NULL;
        
        RAISE NOTICE 'Migrated data from status column to status_1';
        
    ELSE
        RAISE NOTICE 'Old status column does not exist - no migration needed';
    END IF;
END $$;

-- Ensure all videos have a valid status_1 value
-- Set any NULL status_1 values to 'relevance' as default
UPDATE videos 
SET status_1 = 'relevance' 
WHERE status_1 IS NULL;

-- Copy status_1 to status_2 with special logic:
-- 1. Copy all statuses from status_1 to status_2 EXCEPT 'assigned'
-- 2. For videos with 'assigned' in status_1, set status_2 to 'accepted'
UPDATE videos 
SET status_2 = CASE 
    WHEN status_1 = 'assigned' THEN 'accepted'  -- Convert 'assigned' to 'accepted' for Person 2
    ELSE status_1                               -- Copy all other statuses as-is
END
WHERE status_2 IS NULL OR status_2 = 'relevance';

-- Verify the migration
SELECT 
    'Migration Results:' as info,
    status_1,
    status_2,
    COUNT(*) as count
FROM videos 
GROUP BY status_1, status_2
ORDER BY status_1, status_2;

-- Show separate counts for each person
SELECT 'Person 1 Counts:' as info, status_1 as status, COUNT(*) as count
FROM videos 
GROUP BY status_1
ORDER BY status_1;

SELECT 'Person 2 Counts:' as info, status_2 as status, COUNT(*) as count
FROM videos 
GROUP BY status_2
ORDER BY status_2;
