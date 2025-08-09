// Comprehensive diagnostic script for video ID clearing issue
// This will test every component of the video ID clearing flow

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function comprehensiveDiagnosis() {
    console.log('=== COMPREHENSIVE VIDEO ID CLEARING DIAGNOSIS ===\n');
    
    // Test 1: Check database schema
    console.log('1. CHECKING DATABASE SCHEMA...');
    try {
        const { data: columns, error } = await supabase
            .rpc('get_table_columns', { table_name: 'videos' });
        
        if (error) {
            console.log('   Using alternative method to check schema...');
            // Alternative: Query a sample row to see columns
            const { data: sample, error: sampleError } = await supabase
                .from('videos')
                .select('*')
                .limit(1);
            
            if (sample && sample.length > 0) {
                console.log('   Available columns:', Object.keys(sample[0]));
                console.log('   ✅ video_id_text_1 exists:', 'video_id_text_1' in sample[0]);
                console.log('   ✅ status_1 exists:', 'status_1' in sample[0]);
            }
        }
    } catch (error) {
        console.log('   Error checking schema:', error.message);
    }
    
    // Test 2: Check hosts configuration
    console.log('\n2. CHECKING HOSTS CONFIGURATION...');
    try {
        const { data: hosts, error } = await supabase
            .from('hosts')
            .select('*')
            .order('host_id');
            
        if (error) {
            console.log('   ❌ Error fetching hosts:', error.message);
        } else {
            console.log('   Hosts configuration:');
            hosts.forEach(host => {
                console.log(`   Host ${host.host_id}: status=${host.status_column}, video_id=${host.video_id_column}, note=${host.note_column}`);
            });
        }
    } catch (error) {
        console.log('   Error checking hosts:', error.message);
    }
    
    // Test 3: Find a test video with video ID
    console.log('\n3. FINDING TEST VIDEO...');
    let testVideo = null;
    try {
        const { data: videos, error } = await supabase
            .from('videos')
            .select('id, status_1, video_id_text_1, note_1')
            .not('video_id_text_1', 'is', null)
            .limit(1);
            
        if (error) {
            console.log('   ❌ Error finding test video:', error.message);
        } else if (videos && videos.length > 0) {
            testVideo = videos[0];
            console.log('   ✅ Found test video:', testVideo);
        } else {
            console.log('   ⚠️ No videos found with video_id_text_1 value');
        }
    } catch (error) {
        console.log('   Error finding test video:', error.message);
    }
    
    if (!testVideo) {
        console.log('\n❌ Cannot proceed without test video. Exiting diagnosis.');
        return;
    }
    
    // Test 4: Test direct database update
    console.log('\n4. TESTING DIRECT DATABASE UPDATE...');
    const originalValue = testVideo.video_id_text_1;
    console.log(`   Original video_id_text_1 value: "${originalValue}"`);
    
    try {
        // First, try to update to a test value
        const { data: updateData, error: updateError } = await supabase
            .from('videos')
            .update({ video_id_text_1: 'TEST_UPDATE' })
            .eq('id', testVideo.id)
            .select('id, video_id_text_1');
            
        if (updateError) {
            console.log('   ❌ Direct update failed:', updateError.message);
        } else {
            console.log('   ✅ Direct update succeeded:', updateData);
            
            // Verify the update
            const { data: verifyData, error: verifyError } = await supabase
                .from('videos')
                .select('video_id_text_1')
                .eq('id', testVideo.id)
                .single();
                
            if (verifyError) {
                console.log('   ❌ Verification failed:', verifyError.message);
            } else {
                console.log(`   ✅ Verified new value: "${verifyData.video_id_text_1}"`);
                
                // Now try to set it to null
                const { data: nullData, error: nullError } = await supabase
                    .from('videos')
                    .update({ video_id_text_1: null })
                    .eq('id', testVideo.id)
                    .select('id, video_id_text_1');
                    
                if (nullError) {
                    console.log('   ❌ Setting to null failed:', nullError.message);
                } else {
                    console.log('   ✅ Setting to null succeeded:', nullData);
                    
                    // Restore original value
                    await supabase
                        .from('videos')
                        .update({ video_id_text_1: originalValue })
                        .eq('id', testVideo.id);
                    console.log(`   ✅ Restored original value: "${originalValue}"`);
                }
            }
        }
    } catch (error) {
        console.log('   Error in direct update test:', error.message);
    }
    
    // Test 5: Test StatusUpdateService simulation
    console.log('\n5. TESTING STATUSUPDATESERVICE SIMULATION...');
    try {
        // Simulate what StatusUpdateService does
        const hostId = 1;
        const columns = {
            statusColumn: 'status_1',
            videoIdColumn: 'video_id_text_1',
            noteColumn: 'note_1'
        };
        
        const updateData = {
            [columns.statusColumn]: 'accepted',
            [columns.videoIdColumn]: null,
            status_1_updated_at: new Date().toISOString()
        };
        
        console.log('   Simulated update data:', updateData);
        
        const { data: serviceData, error: serviceError } = await supabase
            .from('videos')
            .update(updateData)
            .eq('id', testVideo.id)
            .select('id, status_1, video_id_text_1');
            
        if (serviceError) {
            console.log('   ❌ StatusUpdateService simulation failed:', serviceError.message);
        } else {
            console.log('   ✅ StatusUpdateService simulation succeeded:', serviceData);
            
            // Restore original value
            await supabase
                .from('videos')
                .update({ video_id_text_1: originalValue })
                .eq('id', testVideo.id);
            console.log(`   ✅ Restored original value: "${originalValue}"`);
        }
    } catch (error) {
        console.log('   Error in StatusUpdateService simulation:', error.message);
    }
    
    console.log('\n=== DIAGNOSIS COMPLETE ===');
    console.log('Review the results above to identify the root cause.');
}

// Run the diagnosis
comprehensiveDiagnosis().catch(console.error);
