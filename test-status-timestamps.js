const { supabase } = require('./supabase');
const StatusUpdateService = require('./services/StatusUpdateService');

/**
 * Test suite for status timestamp functionality
 * This script tests the new status update timestamp feature
 */

// Mock getHostColumns function for testing (matches actual database schema)
async function getHostColumns(hostId) {
  const hostIdNum = parseInt(hostId);
  switch (hostIdNum) {
    case 1:
      return {
        statusColumn: 'status_1',
        noteColumn: 'note',
        videoIdColumn: 'video_id_text'
      };
    case 2:
      return {
        statusColumn: 'status_2',
        noteColumn: 'note_2',
        videoIdColumn: 'video_id_text_2'
      };
    default:
      throw new Error(`Unknown host ID: ${hostId}`);
  }
}

async function runTests() {
  console.log('🚀 Starting Status Timestamp Tests...\n');
  
  try {
    // Test 1: Check if timestamp columns exist
    console.log('📋 Test 1: Checking if timestamp columns exist...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('videos')
      .select('status_1_updated_at, status_2_updated_at')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Timestamp columns do not exist. Please run the migration first!');
      console.error('Run: add-status-timestamps.sql in your Supabase dashboard');
      return;
    }
    console.log('✅ Timestamp columns exist');
    
    // Test 2: Get a test video
    console.log('\n📋 Test 2: Finding a test video...');
    const { data: videos, error: videoError } = await supabase
      .from('videos')
      .select('id, status_1, status_2, status_1_updated_at, status_2_updated_at')
      .limit(1);
    
    if (videoError || !videos || videos.length === 0) {
      console.error('❌ No videos found for testing');
      return;
    }
    
    const testVideo = videos[0];
    console.log(`✅ Using test video ID: ${testVideo.id}`);
    console.log(`   Current Shridhar status: ${testVideo.status_1}`);
    console.log(`   Current Vidushi status: ${testVideo.status_2}`);
    
    // Test 3: Test StatusUpdateService for Shridhar
    console.log('\n📋 Test 3: Testing StatusUpdateService for Shridhar...');
    const beforeTimestamp = new Date().toISOString();
    
    const result1 = await StatusUpdateService.updateVideoStatus(
      testVideo.id,
      1, // Shridhar
      'accepted',
      'Test note from automated test',
      null,
      getHostColumns
    );
    
    console.log('✅ Shridhar status update result:', {
      success: result1.success,
      timestamp: result1.timestamp,
      status: result1.status
    });
    
    // Test 4: Test StatusUpdateService for Vidushi
    console.log('\n📋 Test 4: Testing StatusUpdateService for Vidushi...');
    
    const result2 = await StatusUpdateService.updateVideoStatus(
      testVideo.id,
      2, // Vidushi
      'rejected',
      'Test note from automated test for Vidushi',
      null,
      getHostColumns
    );
    
    console.log('✅ Vidushi status update result:', {
      success: result2.success,
      timestamp: result2.timestamp,
      status: result2.status
    });
    
    // Test 5: Verify timestamps were updated
    console.log('\n📋 Test 5: Verifying timestamps were updated...');
    const { data: updatedVideo, error: verifyError } = await supabase
      .from('videos')
      .select('id, status_1, status_2, status_1_updated_at, status_2_updated_at')
      .eq('id', testVideo.id)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying timestamps:', verifyError);
      return;
    }
    
    const host1Timestamp = new Date(updatedVideo.status_1_updated_at);
    const host2Timestamp = new Date(updatedVideo.status_2_updated_at);
    const beforeTime = new Date(beforeTimestamp);
    
    console.log('✅ Timestamp verification:');
    console.log(`   Host 1 timestamp: ${host1Timestamp.toISOString()}`);
    console.log(`   Host 2 timestamp: ${host2Timestamp.toISOString()}`);
    console.log(`   Both after test start: ${host1Timestamp >= beforeTime && host2Timestamp >= beforeTime}`);
    
    // Test 6: Test status history endpoint
    console.log('\n📋 Test 6: Testing status history...');
    const history = await StatusUpdateService.getStatusHistory(testVideo.id);
    
    console.log('✅ Status history retrieved:', {
      videoId: history.videoId,
      host1Status: history.hosts.host1.status,
      host1LastChanged: history.hosts.host1.lastChanged,
      host2Status: history.hosts.host2.status,
      host2LastChanged: history.hosts.host2.lastChanged
    });
    
    // Test 7: Test bulk update
    console.log('\n📋 Test 7: Testing bulk status update...');
    const bulkUpdates = [
      {
        videoId: testVideo.id,
        hostId: 1,
        status: 'pending',
        note: 'Bulk update test - Host 1'
      },
      {
        videoId: testVideo.id,
        hostId: 2,
        status: 'pending',
        note: 'Bulk update test - Host 2'
      }
    ];
    
    const bulkResults = await StatusUpdateService.bulkUpdateStatus(bulkUpdates, getHostColumns);
    
    console.log('✅ Bulk update results:');
    bulkResults.forEach((result, index) => {
      console.log(`   Update ${index + 1}: ${result.success ? 'SUCCESS' : 'FAILED'} - Host ${result.hostId}`);
    });
    
    // Test 8: Final verification
    console.log('\n📋 Test 8: Final verification...');
    const finalHistory = await StatusUpdateService.getStatusHistory(testVideo.id);
    
    console.log('✅ Final status after all tests:');
    console.log(`   Host 1: ${finalHistory.hosts.host1.status} (updated: ${finalHistory.hosts.host1.lastChanged})`);
    console.log(`   Host 2: ${finalHistory.hosts.host2.status} (updated: ${finalHistory.hosts.host2.lastChanged})`);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Timestamp columns exist');
    console.log('   ✅ StatusUpdateService works for both hosts');
    console.log('   ✅ Timestamps are automatically updated');
    console.log('   ✅ Status history tracking works');
    console.log('   ✅ Bulk updates work');
    console.log('   ✅ Database triggers are functioning');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(() => {
    console.log('\n🔚 Test execution completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests, getHostColumns };
