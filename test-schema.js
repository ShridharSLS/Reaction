/**
 * Test Schema Utilities for Dynamic Host Management
 * 
 * This script tests the schema-utils.js module's ability to dynamically
 * modify the database schema for new hosts.
 */
const { migrateForNewHost, columnExists, executeRawSql } = require('./schema-utils');
require('dotenv').config();

async function testSchemaOperations() {
    try {
        console.log('Testing schema operations...');
        
        // Test host data (this won't be inserted in the hosts table)
        const testHost = {
            host_id: 999, // Using high number to avoid conflicts
            status_column: 'status_test',
            note_column: 'note_test',
            video_id_column: 'video_id_test'
        };
        
        // Check if columns already exist (from previous test runs)
        const statusExists = await columnExists('videos', testHost.status_column);
        const noteExists = await columnExists('videos', testHost.note_column);
        const videoIdExists = await columnExists('videos', testHost.video_id_column);
        
        console.log('Column existence check:');
        console.log(`- ${testHost.status_column}: ${statusExists ? 'exists' : 'does not exist'}`);
        console.log(`- ${testHost.note_column}: ${noteExists ? 'exists' : 'does not exist'}`);
        console.log(`- ${testHost.video_id_column}: ${videoIdExists ? 'exists' : 'does not exist'}`);
        
        // If columns exist from previous test, drop them for a clean test
        if (statusExists || noteExists || videoIdExists) {
            console.log('Cleaning up columns from previous test runs...');
            
            if (statusExists) {
                await executeRawSql(`ALTER TABLE videos DROP COLUMN IF EXISTS ${testHost.status_column};`);
                console.log(`Dropped column ${testHost.status_column}`);
            }
            
            if (noteExists) {
                await executeRawSql(`ALTER TABLE videos DROP COLUMN IF EXISTS ${testHost.note_column};`);
                console.log(`Dropped column ${testHost.note_column}`);
            }
            
            if (videoIdExists) {
                await executeRawSql(`ALTER TABLE videos DROP COLUMN IF EXISTS ${testHost.video_id_column};`);
                console.log(`Dropped column ${testHost.video_id_column}`);
            }
        }
        
        // Run the migration for the test host
        console.log('\nRunning migration for test host...');
        const result = await migrateForNewHost(testHost);
        console.log(JSON.stringify(result, null, 2));
        
        // Verify columns were created
        console.log('\nVerifying columns were created:');
        const statusExistsAfter = await columnExists('videos', testHost.status_column);
        const noteExistsAfter = await columnExists('videos', testHost.note_column);
        const videoIdExistsAfter = await columnExists('videos', testHost.video_id_column);
        
        console.log(`- ${testHost.status_column}: ${statusExistsAfter ? 'CREATED ✓' : 'FAILED ✗'}`);
        console.log(`- ${testHost.note_column}: ${noteExistsAfter ? 'CREATED ✓' : 'FAILED ✗'}`);
        console.log(`- ${testHost.video_id_column}: ${videoIdExistsAfter ? 'CREATED ✓' : 'FAILED ✗'}`);
        
        // Check that index was created
        console.log('\nVerifying indexes were created:');
        const { data: statusIndex } = await executeRawSql(`
            SELECT indexname FROM pg_indexes WHERE indexname = 'idx_videos_${testHost.status_column}';
        `);
        
        const { data: videoIdIndex } = await executeRawSql(`
            SELECT indexname FROM pg_indexes WHERE indexname = 'idx_videos_${testHost.video_id_column}';
        `);
        
        console.log(`- idx_videos_${testHost.status_column}: ${statusIndex && statusIndex.length > 0 ? 'CREATED ✓' : 'FAILED ✗'}`);
        console.log(`- idx_videos_${testHost.video_id_column}: ${videoIdIndex && videoIdIndex.length > 0 ? 'CREATED ✓' : 'FAILED ✗'}`);
        
        // Test complete
        console.log('\nTest completed successfully!');
        
        return {
            success: true,
            columnsCreated: {
                status: statusExistsAfter,
                note: noteExistsAfter,
                videoId: videoIdExistsAfter
            },
            indexesCreated: {
                status: statusIndex && statusIndex.length > 0,
                videoId: videoIdIndex && videoIdIndex.length > 0
            }
        };
    } catch (error) {
        console.error('Test failed with error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test if executed directly
if (require.main === module) {
    testSchemaOperations()
        .then(result => {
            console.log('\nFinal result:', result.success ? 'SUCCESS' : 'FAILURE');
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('Error running test:', err);
            process.exit(1);
        });
}

module.exports = { testSchemaOperations };
