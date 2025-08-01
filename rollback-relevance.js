const { executeRawSql } = require('./schema-utils');

async function rollbackSystemWideRelevance() {
    console.log('🔄 Starting rollback of system-wide relevance status...');
    console.log('⚠️  WARNING: This will restore the previous host-specific relevance system');
    
    try {
        // Step 1: Restore relevance status to host-specific columns for unrated videos
        console.log('Step 1: Restoring relevance to status_1 for unrated videos...');
        await executeRawSql(`
            UPDATE videos 
            SET status_1 = 'relevance'
            WHERE relevance_status = 'relevance';
        `);
        console.log('✅ Relevance restored to status_1');

        // Step 2: Remove pending status from host columns for videos that were migrated
        console.log('Step 2: Removing auto-assigned pending status from host columns...');
        
        // Get all active hosts
        const hostsResult = await executeRawSql(`
            SELECT status_column FROM hosts WHERE is_active = true;
        `);
        
        if (hostsResult && Array.isArray(hostsResult)) {
            const statusColumns = hostsResult.map(host => host.status_column);
            const setClause = statusColumns.map(col => `${col} = 'relevance'`).join(', ');
            
            await executeRawSql(`
                UPDATE videos 
                SET ${setClause}
                WHERE relevance_rating >= 0 
                  AND relevance_rating <= 3 
                  AND relevance_status IS NULL;
            `);
        }
        console.log('✅ Pending status removed from migrated videos');

        // Step 3: Drop the index we created
        console.log('Step 3: Dropping relevance_status index...');
        await executeRawSql(`
            DROP INDEX IF EXISTS idx_videos_relevance_status;
        `);
        console.log('✅ Index dropped');

        // Step 4: Rename relevance_status back to is_shridhar and convert to boolean
        console.log('Step 4: Converting relevance_status back to is_shridhar boolean...');
        await executeRawSql(`
            ALTER TABLE videos 
            RENAME COLUMN relevance_status TO is_shridhar;
        `);
        
        await executeRawSql(`
            ALTER TABLE videos 
            ALTER COLUMN is_shridhar TYPE BOOLEAN USING (is_shridhar = 'true'),
            ALTER COLUMN is_shridhar SET DEFAULT FALSE;
        `);
        console.log('✅ Column converted back to boolean');

        // Step 5: Verify rollback results
        console.log('Step 5: Verifying rollback results...');
        const verificationResult = await executeRawSql(`
            SELECT 
                COUNT(*) FILTER (WHERE status_1 = 'relevance') as host1_relevance,
                COUNT(*) FILTER (WHERE status_2 = 'relevance') as host2_relevance,
                COUNT(*) FILTER (WHERE status_11 = 'relevance') as host11_relevance,
                COUNT(*) FILTER (WHERE is_shridhar IS NOT NULL) as is_shridhar_values,
                COUNT(*) FILTER (WHERE relevance_rating = -1) as unrated_videos
            FROM videos;
        `);
        
        console.log('📊 Rollback Results:');
        console.log(verificationResult);
        
        console.log('🎉 Rollback completed successfully!');
        console.log('');
        console.log('Summary of rollback:');
        console.log('- Relevance is back to host-specific (not system-wide)');
        console.log('- Videos with relevance_rating = -1 are back in status_1 = relevance');
        console.log('- is_shridhar column restored as boolean');
        console.log('- Host-specific columns handle all statuses again');
        
    } catch (error) {
        console.error('❌ Rollback failed:', error);
        console.error('');
        console.error('Manual intervention may be required to restore the database state.');
        throw error;
    }
}

// Run rollback if this script is executed directly
if (require.main === module) {
    rollbackSystemWideRelevance()
        .then(() => {
            console.log('Rollback script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Rollback script failed:', error);
            process.exit(1);
        });
}

module.exports = { rollbackSystemWideRelevance };
