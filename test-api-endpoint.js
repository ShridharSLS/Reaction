// Test script to directly call the API endpoint and see what happens
const fetch = require('node-fetch');

async function testApiEndpoint() {
    console.log('=== TESTING API ENDPOINT DIRECTLY ===\n');
    
    // Test the exact same API call that the frontend makes
    const videoId = 84;
    const hostId = 1;
    const apiUrl = `http://localhost:3000/api/videos/${videoId}/host/${hostId}/status`;
    
    console.log(`Testing API endpoint: ${apiUrl}`);
    console.log('Request body: { status: "accepted", video_id_text: null }');
    
    try {
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status: 'accepted',
                video_id_text: null
            })
        });
        
        console.log('\nResponse status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        const responseText = await response.text();
        console.log('Response body:', responseText);
        
        if (response.ok) {
            console.log('\n✅ API call succeeded');
            
            // Now check if the database was actually updated
            const { createClient } = require('@supabase/supabase-js');
            require('dotenv').config();
            
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
            
            const { data: updatedVideo, error } = await supabase
                .from('videos')
                .select('id, status_1, video_id_text_1')
                .eq('id', videoId)
                .single();
                
            if (error) {
                console.log('❌ Error checking updated video:', error.message);
            } else {
                console.log('Updated video data:', updatedVideo);
                console.log(`video_id_text_1 value: "${updatedVideo.video_id_text_1}"`);
                
                if (updatedVideo.video_id_text_1 === null) {
                    console.log('✅ SUCCESS: Video ID was cleared!');
                } else {
                    console.log('❌ FAILED: Video ID was NOT cleared');
                }
            }
        } else {
            console.log('\n❌ API call failed');
        }
        
    } catch (error) {
        console.log('\n❌ Error calling API:', error.message);
    }
}

// Run the test
testApiEndpoint().catch(console.error);
