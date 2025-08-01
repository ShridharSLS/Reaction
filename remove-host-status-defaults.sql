-- =====================================================
-- MIGRATION: Remove DEFAULT 'relevance' from Host Status Columns
-- Purpose: Fix the root cause of 'relevance' appearing in host-specific columns
-- Date: 2025-08-01
-- =====================================================

-- The problem: Host status columns have DEFAULT 'relevance' set at the database level
-- This causes new video insertions to automatically get 'relevance' in host columns
-- even when our application code sets them to null

-- First, let's see which status columns exist and have defaults
SELECT 
    column_name, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'videos' 
  AND column_name LIKE 'status_%' 
ORDER BY column_name;

-- Now remove defaults only from columns that exist
-- We'll use DO blocks to handle conditional logic

DO $$
BEGIN
    -- Check and remove default from status_1
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_1') THEN
        ALTER TABLE videos ALTER COLUMN status_1 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_1';
    END IF;
    
    -- Check and remove default from status_2
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_2') THEN
        ALTER TABLE videos ALTER COLUMN status_2 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_2';
    END IF;
    
    -- Check and remove default from status_3
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_3') THEN
        ALTER TABLE videos ALTER COLUMN status_3 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_3';
    END IF;
    
    -- Check and remove default from status_4
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_4') THEN
        ALTER TABLE videos ALTER COLUMN status_4 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_4';
    END IF;
    
    -- Check and remove default from status_5
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_5') THEN
        ALTER TABLE videos ALTER COLUMN status_5 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_5';
    END IF;
    
    -- Check and remove default from status_6
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_6') THEN
        ALTER TABLE videos ALTER COLUMN status_6 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_6';
    END IF;
    
    -- Check and remove default from status_7
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_7') THEN
        ALTER TABLE videos ALTER COLUMN status_7 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_7';
    END IF;
    
    -- Check and remove default from status_8
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_8') THEN
        ALTER TABLE videos ALTER COLUMN status_8 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_8';
    END IF;
    
    -- Check and remove default from status_9
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_9') THEN
        ALTER TABLE videos ALTER COLUMN status_9 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_9';
    END IF;
    
    -- Check and remove default from status_10
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_10') THEN
        ALTER TABLE videos ALTER COLUMN status_10 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_10';
    END IF;
    
    -- Check and remove default from status_11
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_11') THEN
        ALTER TABLE videos ALTER COLUMN status_11 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_11';
    END IF;
    
    -- Check and remove default from status_12
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'videos' AND column_name = 'status_12') THEN
        ALTER TABLE videos ALTER COLUMN status_12 DROP DEFAULT;
        RAISE NOTICE 'Removed default from status_12';
    END IF;
END $$;

-- Final verification: Check that defaults have been removed
SELECT 
    column_name, 
    column_default,
    CASE 
        WHEN column_default IS NULL THEN '✅ No default (GOOD)'
        ELSE '❌ Has default: ' || column_default
    END as status
FROM information_schema.columns 
WHERE table_name = 'videos' 
  AND column_name LIKE 'status_%' 
ORDER BY column_name;

-- After running this migration:
-- 1. New videos will have NULL in host status columns by default
-- 2. Our application logic will work correctly
-- 3. Only relevance_status (system-wide) should be set for unrated videos
