const { executeRawSql } = require('./schema-utils');

async function migrateToSystemWideRelevance() {
    console.log('🚀 Starting migration to system-wide relevance status...');
    
    try {
        // Step 1: Rename and modify the obsolete is_shridhar column to relevance_status
        console.log('Step 1: Converting is_shridhar column to relevance_status...');
        await executeRawSql(`
            ALTER TABLE videos 
            ALTER COLUMN is_shridhar TYPE VARCHAR(20),
            ALTER COLUMN is_shridhar SET DEFAULT NULL;
        `);
        
        await executeRawSql(`
            ALTER TABLE videos 
            RENAME COLUMN is_shridhar TO relevance_status;
        `);
        console.log('✅ Column converted successfully');

        // Step 2: Set system-wide relevance status for unrated videos
        console.log('Step 2: Setting system-wide relevance status for unrated videos...');
        const result1 = await executeRawSql(`
            UPDATE videos 
            SET relevance_status = 'relevance' 
            WHERE relevance_rating = -1;
        `);
        console.log('✅ System-wide relevance status set for unrated videos');

        // Step 3: Clear relevance status from all host-specific status columns
        console.log('Step 3: Clearing relevance from host-specific columns...');
        
        // Get all active hosts to clear relevance from their status columns
        const hostsResult = await executeRawSql(`
            SELECT status_column FROM hosts WHERE is_active = true;
        `);
        
        if (hostsResult && Array.isArray(hostsResult)) {
            for (const host of hostsResult) {
                const statusColumn = host.status_column;
                console.log(`  Clearing relevance from ${statusColumn}...`);
                await executeRawSql(`
                    UPDATE videos 
                    SET ${statusColumn} = NULL 
                    WHERE ${statusColumn} = 'relevance';
                `);
            }
        }
        console.log('✅ Relevance cleared from all host-specific columns');

        // Step 4: Set rated videos to pending in ALL host columns
        console.log('Step 4: Setting rated videos to pending in all host columns...');
        
        // Build dynamic UPDATE query for all host status columns
        const statusColumns = hostsResult.map(host => host.status_column);
        const setClause = statusColumns.map(col => `${col} = 'pending'`).join(', ');
        
        await executeRawSql(`
            UPDATE videos 
            SET ${setClause}
            WHERE relevance_rating >= 0 
              AND relevance_rating <= 3 
              AND relevance_status IS NULL;
        `);
        console.log('✅ Rated videos set to pending in all host columns');

        // Step 5: Create index for performance
        console.log('Step 5: Creating index on relevance_status...');
        await executeRawSql(`
            CREATE INDEX IF NOT EXISTS idx_videos_relevance_status ON videos(relevance_status);
        `);
        console.log('✅ Index created successfully');

        // Step 6: Verify migration results
        console.log('Step 6: Verifying migration results...');
        const verificationResult = await executeRawSql(`
            SELECT 
                COUNT(*) FILTER (WHERE relevance_status = 'relevance') as videos_in_relevance,
                COUNT(*) FILTER (WHERE status_1 = 'pending') as host1_pending,
                COUNT(*) FILTER (WHERE status_2 = 'pending') as host2_pending,
                COUNT(*) FILTER (WHERE status_11 = 'pending') as host11_pending,
                COUNT(*) FILTER (WHERE relevance_rating = -1) as unrated_videos,
                COUNT(*) FILTER (WHERE relevance_rating >= 0 AND relevance_rating <= 3) as rated_videos
            FROM videos;
        `);
        
        console.log('📊 Migration Results:');
        console.log(verificationResult);
        
        console.log('🎉 Migration completed successfully!');
        console.log('');
        console.log('Summary of changes:');
        console.log('- Relevance is now system-wide (not host-specific)');
        console.log('- Videos with relevance_rating = -1 are in system-wide relevance status');
        console.log('- Rated videos (0-3) are now pending for ALL hosts');
        console.log('- Host-specific columns only handle pending/accepted/rejected/assigned');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error('');
        console.error('To rollback, run: node rollback-relevance.js');
        throw error;
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    migrateToSystemWideRelevance()
        .then(() => {
            console.log('Migration script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateToSystemWideRelevance };
