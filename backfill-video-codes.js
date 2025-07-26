const { supabase } = require('./supabase');

// Video code extraction function (same as in server.js)
function extractVideoCode(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    
    // YouTube patterns
    const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,  // Regular and short URLs
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,                    // YouTube Shorts
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,                     // Embedded videos
        /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/                 // Mobile URLs
    ];
    
    // Instagram patterns
    const instagramPatterns = [
        /instagram\.com\/reel\/([a-zA-Z0-9_-]{11})/,                    // Instagram Reels
        /instagram\.com\/p\/([a-zA-Z0-9_-]{11})/,                       // Instagram Posts
        /instagram\.com\/stories\/[^\/]+\/([a-zA-Z0-9_-]{11})/          // Instagram Stories
    ];
    
    // Try YouTube patterns first
    for (const pattern of youtubePatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    // Try Instagram patterns
    for (const pattern of instagramPatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    // No pattern matched
    return null;
}

async function backfillVideoCodes() {
    console.log('Starting video code backfill process...');
    
    try {
        // Get all videos that don't have video_code set
        const { data: videos, error: fetchError } = await supabase
            .from('videos')
            .select('id, link')
            .is('video_code', null);
            
        if (fetchError) {
            console.error('Error fetching videos:', fetchError);
            return;
        }
        
        console.log(`Found ${videos.length} videos without video codes`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const video of videos) {
            const videoCode = extractVideoCode(video.link);
            
            if (videoCode) {
                // Update the video with the extracted code
                const { error: updateError } = await supabase
                    .from('videos')
                    .update({ video_code: videoCode })
                    .eq('id', video.id);
                    
                if (updateError) {
                    console.error(`Error updating video ${video.id}:`, updateError);
                } else {
                    console.log(`Updated video ${video.id} with code: ${videoCode}`);
                    updatedCount++;
                }
            } else {
                console.log(`Skipped video ${video.id} - no code extractable from: ${video.link}`);
                skippedCount++;
            }
        }
        
        console.log(`\nBackfill complete:`);
        console.log(`- Updated: ${updatedCount} videos`);
        console.log(`- Skipped: ${skippedCount} videos (unsupported URL format)`);
        
    } catch (error) {
        console.error('Backfill process failed:', error);
    }
}

// Run the backfill
backfillVideoCodes();
