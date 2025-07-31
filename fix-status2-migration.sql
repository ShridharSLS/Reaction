-- Fix status_2 migration - ensure all assigned videos become accepted in status_2
-- This corrects the previous migration that didn't work properly

-- Update status_2 for ALL videos based on status_1 with the correct logic:
-- 1. Copy all statuses from status_1 to status_2 EXCEPT 'assigned'
-- 2. For videos with 'assigned' in status_1, set status_2 to 'accepted'
UPDATE videos 
SET status_2 = CASE 
    WHEN status_1 = 'assigned' THEN 'accepted'  -- Convert 'assigned' to 'accepted' for Person 2
    ELSE status_1                               -- Copy all other statuses as-is
END;

-- Verify the fix
SELECT 
    'After Fix - Migration Results:' as info,
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

-- Specifically check that no videos have 'assigned' in status_2
SELECT 
    'Videos with assigned in status_2 (should be 0):' as info,
    COUNT(*) as count
FROM videos 
WHERE status_2 = 'assigned';
