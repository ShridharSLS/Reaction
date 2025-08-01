const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { supabase, initializeDatabase, updateScore } = require('./supabase');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ===== DYNAMIC COLUMN MAPPING SYSTEM =====
// Centralized column mapping for all hosts (removes hardcoded column references)
function getHostColumns(hostId) {
    const hostNum = parseInt(hostId);
    if (hostNum === 1) {
        return {
            statusColumn: 'status_1',
            noteColumn: 'note',
            videoIdColumn: 'video_id_text'
        };
    } else {
        return {
            statusColumn: `status_${hostNum}`,
            noteColumn: `note_${hostNum}`,
            videoIdColumn: `video_id_text_${hostNum}`
        };
    }
}

// Get all status columns for operations that need to update multiple hosts
function getAllStatusColumns() {
    return {
        host1: 'status_1',
        host2: 'status_2'
        // Add more hosts as needed
    };
}

// Get status column for a specific host
function getStatusColumn(hostId) {
    const hostNum = parseInt(hostId);
    return hostNum === 1 ? 'status_1' : `status_${hostNum}`;
}

// Get note column for a specific host
function getNoteColumn(hostId) {
    const hostNum = parseInt(hostId);
    return hostNum === 1 ? 'note' : `note_${hostNum}`;
}

// Get video ID column for a specific host
function getVideoIdColumn(hostId) {
    const hostNum = parseInt(hostId);
    return hostNum === 1 ? 'video_id_text' : `video_id_text_${hostNum}`;
}

// Get count key for a specific host and status (for backward compatibility with frontend)
function getCountKey(hostId, status) {
    const hostNum = parseInt(hostId);
    if (hostNum === 1) {
        // Host 1 uses the original count keys
        return status; // e.g., 'pending', 'accepted'
    } else {
        // Other hosts use prefixed count keys
        return `person${hostNum}_${status}`; // e.g., 'person2_pending'
    }
}

// Video code extraction function for duplicate detection
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

// Initialize database
initializeDatabase().then(() => {
    console.log('Database initialized successfully');
}).catch(err => {
    console.error('Database initialization failed:', err);
});

// Public Routes
app.get('/submit', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'submit.html'));
});

// API Routes

// Get all people
app.get('/api/people', async (req, res) => {
    try {
        const { archived } = req.query;
        
        let query = supabase
            .from('people')
            .select('*');
            
        // Filter by archived status
        if (archived === 'true') {
            query = query.eq('archived', true);
        } else {
            // Default: only show non-archived people
            query = query.eq('archived', false);
        }
        
        const { data, error } = await query.order('name');
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new person
app.post('/api/people', async (req, res) => {
    try {
        const { name } = req.body;
        
        const { data, error } = await supabase
            .from('people')
            .insert([{ name }])
            .select()
            .single();
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update person name
app.put('/api/people/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        
        const { error } = await supabase
            .from('people')
            .update({ name })
            .eq('id', id);
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ message: 'Person updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete person
app.delete('/api/people/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete person directly - no need to check for videos since people list is just for form dropdown
        const { error } = await supabase
            .from('people')
            .delete()
            .eq('id', id);
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ message: 'Person deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Archive a person
app.put('/api/people/:id/archive', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('people')
            .update({ archived: true })
            .eq('id', id)
            .select()
            .single();
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ message: 'Person archived successfully', person: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Unarchive a person
app.put('/api/people/:id/unarchive', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('people')
            .update({ archived: false })
            .eq('id', id)
            .select()
            .single();
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ message: 'Person unarchived successfully', person: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all database entries for All view
app.get('/api/videos/all/entries', async (req, res) => {
    try {
        // Get all videos
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (videosError) {
            console.error('Error fetching videos:', videosError);
            return res.status(500).json({ error: 'Failed to fetch videos' });
        }
        
        // Get all people separately (no foreign key constraint)
        const { data: people, error: peopleError } = await supabase
            .from('people')
            .select('*');
        
        if (peopleError) {
            console.error('Error fetching people:', peopleError);
            return res.status(500).json({ error: 'Failed to fetch people' });
        }
        
        // Create a map of person_id to person name
        const peopleMap = {};
        people.forEach(person => {
            peopleMap[person.id] = person.name;
        });
        
        // Add person names to videos
        const videosWithNames = videos.map(video => ({
            ...video,
            person_name: peopleMap[video.person_id] || 'Unknown'
        }));
        
        res.json(videosWithNames);
    } catch (error) {
        console.error('Error in /api/videos/all/entries:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get counts for all video statuses in a single call (performance optimization)
app.get('/api/videos/counts', async (req, res) => {
    try {
        // Dynamic column selection for all hosts
        const allStatusColumns = getAllStatusColumns();
        const selectColumns = Object.values(allStatusColumns).join(', ') + ', relevance_rating';
        
        console.log(`[Dynamic Counts] Selecting columns: ${selectColumns}`);
        
        // Single query to get all videos with dynamic column selection
        const { data: videos, error } = await supabase
            .from('videos')
            .select(selectColumns);
        
        if (error) {
            console.error('Error fetching video counts:', error);
            return res.status(500).json({ error: 'Failed to fetch counts' });
        }
        
        // ===== UNIFIED DYNAMIC COUNT SYSTEM =====
        // Generate count keys dynamically for all hosts
        const statusTypes = ['relevance', 'pending', 'accepted', 'rejected', 'assigned'];
        const hostStatusColumns = getAllStatusColumns();
        const hostIds = Object.keys(hostStatusColumns).map(key => key.replace('host', ''));
        
        console.log(`[Dynamic Counts] Generating counts for hosts: ${hostIds.join(', ')}`);
        
        // Dynamic count initialization for all hosts
        const counts = {
            all: videos.length
        };
        
        // Initialize count keys dynamically for all hosts
        hostIds.forEach(hostId => {
            statusTypes.forEach(status => {
                const countKey = getCountKey(parseInt(hostId), status);
                counts[countKey] = 0;
            });
        });
        
        console.log(`[Dynamic Counts] Initialized count keys:`, Object.keys(counts).filter(key => key !== 'all'));
        
        // Count videos dynamically for all hosts
        videos.forEach(video => {
            hostIds.forEach(hostId => {
                const hostIdNum = parseInt(hostId);
                const statusColumn = getStatusColumn(hostIdNum);
                const videoStatus = video[statusColumn];
                
                // Count based on status with relevance special handling
                if (videoStatus === 'relevance' && video.relevance_rating === -1) {
                    const countKey = getCountKey(hostIdNum, 'relevance');
                    counts[countKey]++;
                } else if (statusTypes.includes(videoStatus)) {
                    const countKey = getCountKey(hostIdNum, videoStatus);
                    counts[countKey]++;
                }
            });
        });
        
        console.log(`[Dynamic Counts] Final counts:`, counts);
        
        res.json(counts);
    } catch (error) {
        console.error('Error in /api/videos/counts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get videos by status (Legacy endpoint for Host 1 - now uses dynamic column mapping)
app.get('/api/videos/:status', async (req, res) => {
    try {
        const { status } = req.params;
        
        // Use dynamic column mapping for Host 1 (backward compatibility)
        const host1StatusColumn = getStatusColumn(1);
        
        console.log(`[Legacy Endpoint] Getting Host 1 videos with status ${status} using column ${host1StatusColumn}`);
        
        // Get videos without JOIN since we removed the foreign key constraint
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq(host1StatusColumn, status)
            .order('type', { ascending: false }) // Trending first
            .order('score', { ascending: false, nullsFirst: false })
            .order('likes_count', { ascending: false, nullsFirst: false });
            
        if (videosError) {
            res.status(500).json({ error: videosError.message });
            return;
        }
        
        // Get all people to map names
        const { data: people, error: peopleError } = await supabase
            .from('people')
            .select('id, name');
            
        if (peopleError) {
            res.status(500).json({ error: peopleError.message });
            return;
        }
        
        // Create a lookup map for people names
        const peopleMap = {};
        people?.forEach(person => {
            peopleMap[person.id] = person.name;
        });
        
        // Get all tags for all videos in one query (performance optimization)
        const videoIds = videos?.map(v => v.id) || [];
        let videoTagsMap = {};
        
        if (videoIds.length > 0) {
            const { data: videoTags, error: tagsError } = await supabase
                .from('video_tags')
                .select(`
                    video_id,
                    tags (
                        id,
                        name,
                        color
                    )
                `)
                .in('video_id', videoIds);
            
            if (!tagsError && videoTags) {
                // Group tags by video_id
                videoTags.forEach(vt => {
                    if (!videoTagsMap[vt.video_id]) {
                        videoTagsMap[vt.video_id] = [];
                    }
                    videoTagsMap[vt.video_id].push(vt.tags);
                });
            }
        }
        
        // Transform the data to include person names and tags
        const transformedData = videos?.map(video => ({
            ...video,
            added_by_name: peopleMap[video.added_by] || 'Unknown',
            tags: videoTagsMap[video.id] || []
        })) || [];
        
        res.json(transformedData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Host 2 videos by status (queries status_2 column)
app.get('/api/videos/host2/:status', async (req, res) => {
    try {
        const { status } = req.params;
        
        // Get videos from status_2 column (Host 2 workflow)
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq('status_2', status)
            .order('type', { ascending: false }) // Trending first
            .order('score', { ascending: false, nullsFirst: false })
            .order('likes_count', { ascending: false, nullsFirst: false });
            
        if (videosError) {
            res.status(500).json({ error: videosError.message });
            return;
        }
        
        // Get all people to map names
        const { data: people, error: peopleError } = await supabase
            .from('people')
            .select('id, name');
            
        if (peopleError) {
            res.status(500).json({ error: peopleError.message });
            return;
        }
        
        // Create a lookup map for people names
        const peopleMap = {};
        people?.forEach(person => {
            peopleMap[person.id] = person.name;
        });
        
        // Get all tags for all videos in one query (performance optimization)
        let videoTagsMap = {};
        if (videos && videos.length > 0) {
            const videoIds = videos.map(v => v.id);
            const { data: videoTags, error: tagsError } = await supabase
                .from('video_tags')
                .select(`
                    video_id,
                    tags (id, name)
                `)
                .in('video_id', videoIds);
                
            if (!tagsError && videoTags) {
                videoTags.forEach(vt => {
                    if (!videoTagsMap[vt.video_id]) {
                        videoTagsMap[vt.video_id] = [];
                    }
                    videoTagsMap[vt.video_id].push(vt.tags);
                });
            }
        }
        
        // Transform the data to include person names and tags
        const transformedData = videos?.map(video => ({
            ...video,
            added_by_name: peopleMap[video.added_by] || 'Unknown',
            tags: videoTagsMap[video.id] || []
        })) || [];
        
        res.json(transformedData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new video
app.post('/api/videos', async (req, res) => {
    try {
        const { added_by, added_by_name, link, type, likes_count, video_id_text, relevance_rating, status } = req.body;
        
        let personId = added_by;
        
        // If added_by_name is provided (legacy admin form), find or create person
        if (added_by_name && !added_by) {
            // First, try to find existing person with this name
            const { data: existingPerson } = await supabase
                .from('people')
                .select('id')
                .eq('name', added_by_name)
                .single();
                
            if (existingPerson) {
                personId = existingPerson.id;
            } else {
                // Create new person (only for admin form)
                const { data: newPerson, error: personError } = await supabase
                    .from('people')
                    .insert([{ name: added_by_name }])
                    .select()
                    .single();
                    
                if (personError) {
                    res.status(500).json({ error: 'Failed to create person: ' + personError.message });
                    return;
                }
                
                personId = newPerson.id;
            }
        }
        
        // For public form submissions, added_by should be provided directly
        if (!personId) {
            res.status(400).json({ error: 'Person selection is required' });
            return;
        }
        
        // Verify the person exists
        const { data: person, error: personCheckError } = await supabase
            .from('people')
            .select('id')
            .eq('id', personId)
            .single();
            
        if (personCheckError || !person) {
            res.status(400).json({ error: 'Selected person does not exist' });
            return;
        }
        
        // Extract video code for smart duplicate detection
        const videoCode = extractVideoCode(link);
        
        // Check for duplicate using video code (if extractable) or fallback to URL
        let duplicateCheckQuery;
        if (videoCode) {
            // Check by video code first (smart duplicate detection)
            duplicateCheckQuery = supabase
                .from('videos')
                .select('id, link')
                .eq('video_code', videoCode)
                .single();
        } else {
            // Fallback to URL check for unsupported platforms
            duplicateCheckQuery = supabase
                .from('videos')
                .select('id, link')
                .eq('link', link)
                .single();
        }
        
        const { data: existingVideo, error: duplicateCheckError } = await duplicateCheckQuery;
            
        if (existingVideo) {
            const errorMessage = videoCode 
                ? `This video already exists in the system (found via video ID: ${videoCode}). Existing URL: ${existingVideo.link}`
                : 'A video with this URL already exists in the system';
            res.status(409).json({ error: errorMessage });
            return;
        }
        
        // Prepare video data with video_code for smart duplicate detection
        // Dynamic status column assignment for all hosts
        const videoData = {
            added_by: personId,
            link,
            type,
            likes_count: likes_count || 0,
            video_id_text,
            video_code: videoCode,  // Store extracted video code
            relevance_rating: relevance_rating !== undefined ? relevance_rating : -1,  // Use provided or default to -1
        };
        
        // Set initial status for all hosts using dynamic column mapping
        const allStatusColumns = getAllStatusColumns();
        Object.values(allStatusColumns).forEach(statusColumn => {
            videoData[statusColumn] = status || 'relevance';
        });
        
        console.log(`[Dynamic Video Creation] Setting status columns:`, Object.keys(allStatusColumns), 'to:', status || 'relevance');
        
        const { data, error } = await supabase
            .from('videos')
            .insert([videoData])
            .select()
            .single();
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        // Calculate initial score
        await updateScore(data.id);
        
        res.json({ id: data.id, message: 'Video added successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check for duplicate videos (for real-time validation)
app.get('/api/videos/check-duplicate', async (req, res) => {
    try {
        const { video_code, url } = req.query;
        
        let duplicateCheckQuery;
        if (video_code) {
            // Check by video code (smart duplicate detection)
            duplicateCheckQuery = supabase
                .from('videos')
                .select('id, link')
                .eq('video_code', video_code)
                .single();
        } else if (url) {
            // Fallback to URL check for unsupported platforms
            duplicateCheckQuery = supabase
                .from('videos')
                .select('id, link')
                .eq('link', url)
                .single();
        } else {
            res.status(400).json({ error: 'Either video_code or url parameter is required' });
            return;
        }
        
        const { data: existingVideo, error } = await duplicateCheckQuery;
        
        if (existingVideo) {
            res.json({ 
                isDuplicate: true, 
                existingUrl: existingVideo.link,
                videoId: existingVideo.id
            });
        } else {
            res.json({ isDuplicate: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update video relevance rating
app.put('/api/videos/:id/relevance', async (req, res) => {
    try {
        const { id } = req.params;
        const { relevance_rating } = req.body;
        
        // Prepare update data
        const updateData = { relevance_rating };
        
        // If relevance rating is 0-3, move from 'relevance' to 'pending' status
        if (relevance_rating >= 0 && relevance_rating <= 3) {
            // Dynamic column selection for status check
            const allStatusColumns = getAllStatusColumns();
            const selectColumns = Object.values(allStatusColumns).join(', ');
            
            // Check if video is currently in relevance status
            const { data: video } = await supabase
                .from('videos')
                .select(selectColumns)
                .eq('id', id)
                .single();
                
            // Check if any host has the video in 'relevance' status and update all to 'pending'
            if (video) {
                const host1StatusColumn = getStatusColumn(1);
                if (video[host1StatusColumn] === 'relevance') {
                    console.log(`[Dynamic Relevance] Moving video ${id} from relevance to pending for all hosts`);
                    
                    // Update all hosts' status columns to 'pending' simultaneously
                    Object.values(allStatusColumns).forEach(statusColumn => {
                        updateData[statusColumn] = 'pending';
                    });
                }
            }
        }
        
        const { error } = await supabase
            .from('videos')
            .update(updateData)
            .eq('id', id);
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        // Update score after relevance change
        await updateScore(id);
        
        res.json({ message: 'Relevance rating updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update video status (Legacy endpoint for Host 1 - now uses dynamic column mapping)
app.put('/api/videos/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, video_id_text, note } = req.body;
        
        // Use dynamic column mapping for Host 1 (backward compatibility)
        const host1Columns = getHostColumns(1);
        const updateData = {};
        updateData[host1Columns.statusColumn] = status;
        
        if (video_id_text !== undefined) {
            updateData[host1Columns.videoIdColumn] = video_id_text;
        }
        if (note !== undefined) {
            updateData[host1Columns.noteColumn] = note;
        }
        
        console.log(`[Legacy Endpoint] Updating Host 1 with dynamic columns:`, updateData);
        
        const { error } = await supabase
            .from('videos')
            .update(updateData)
            .eq('id', id);
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ message: 'Video status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Host 2 video status (Legacy endpoint for Host 2 - now uses dynamic column mapping)
app.put('/api/videos/:id/host2/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, video_id_text, note } = req.body;
        
        // Use dynamic column mapping for Host 2 (backward compatibility)
        const host2Columns = getHostColumns(2);
        const updateData = {};
        updateData[host2Columns.statusColumn] = status;
        
        if (video_id_text !== undefined) {
            updateData[host2Columns.videoIdColumn] = video_id_text;
        }
        if (note !== undefined) {
            updateData[host2Columns.noteColumn] = note;
        }
        
        console.log(`[Legacy Endpoint] Updating Host 2 with dynamic columns:`, updateData);
        
        const { error } = await supabase
            .from('videos')
            .update(updateData)
            .eq('id', id);
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ message: 'Host 2 video status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== UNIFIED GENERIC HOST API ENDPOINT =====
// Update video status for any host (replaces host-specific endpoints)
app.put('/api/videos/:id/host/:hostId/status', async (req, res) => {
    try {
        const { id, hostId } = req.params;
        const { status, video_id_text, note } = req.body;
        
        // Use centralized dynamic column mapping system
        const columns = getHostColumns(hostId);
        
        // Build update data dynamically
        const updateData = {};
        updateData[columns.statusColumn] = status;
        
        if (video_id_text !== undefined) {
            updateData[columns.videoIdColumn] = video_id_text;
        }
        if (note !== undefined) {
            updateData[columns.noteColumn] = note;
        }
        
        console.log(`[Generic API] Updating video ${id} for host ${hostId}:`, updateData);
        
        const { error } = await supabase
            .from('videos')
            .update(updateData)
            .eq('id', id);
            
        if (error) {
            console.error(`[Generic API] Error updating video ${id} for host ${hostId}:`, error);
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ 
            message: `Host ${hostId} video status updated successfully`,
            hostId: hostId,
            columns: columns,
            updateData: updateData
        });
    } catch (err) {
        console.error(`[Generic API] Exception:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Get videos by status for any host (replaces host-specific endpoints)
app.get('/api/videos/host/:hostId/:status', async (req, res) => {
    try {
        const { hostId, status } = req.params;
        
        // Use centralized dynamic column mapping system
        const statusColumn = getStatusColumn(hostId);
        
        console.log(`[Generic API] Getting videos for host ${hostId}, status ${status}, column ${statusColumn}`);
        
        // Get videos from the appropriate status column
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq(statusColumn, status)
            .order('type', { ascending: false }) // Trending first
            .order('score', { ascending: false, nullsFirst: false })
            .order('likes_count', { ascending: false, nullsFirst: false });
            
        if (videosError) {
            console.error(`[Generic API] Error getting videos for host ${hostId}:`, videosError);
            res.status(500).json({ error: videosError.message });
            return;
        }
        
        // Get all people to map names
        const { data: people, error: peopleError } = await supabase
            .from('people')
            .select('id, name');
            
        if (peopleError) {
            res.status(500).json({ error: peopleError.message });
            return;
        }
        
        // Create a lookup map for people names
        const peopleMap = {};
        people.forEach(person => {
            peopleMap[person.id] = person.name;
        });
        
        // Add person names to videos
        const videosWithNames = videos.map(video => ({
            ...video,
            person_name: peopleMap[video.person_id] || 'Unknown'
        }));
        
        console.log(`[Generic API] Found ${videosWithNames.length} videos for host ${hostId}, status ${status}`);
        
        res.json({
            videos: videosWithNames,
            hostId: hostId,
            status: status,
            statusColumn: statusColumn,
            count: videosWithNames.length
        });
    } catch (err) {
        console.error(`[Generic API] Exception:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Update video note
app.put('/api/videos/:id/note', async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        
        const { error } = await supabase
            .from('videos')
            .update({ note: note || null })
            .eq('id', id);
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ message: 'Note updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete video
app.delete('/api/videos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('videos')
            .delete()
            .eq('id', id);
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ message: 'Video deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update video type
app.put('/api/videos/:id/type', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;
        
        // Validate type
        if (!['Trending', 'General'].includes(type)) {
            res.status(400).json({ error: 'Invalid video type. Must be Trending or General.' });
            return;
        }
        
        const { error } = await supabase
            .from('videos')
            .update({ type })
            .eq('id', id);
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ message: 'Video type updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export videos to CSV (Legacy endpoint for Host 1 - now uses dynamic column mapping)
app.get('/api/videos/:status/export', async (req, res) => {
    try {
        const { status } = req.params;
        
        // Use dynamic column mapping for Host 1 (backward compatibility)
        const host1StatusColumn = getStatusColumn(1);
        
        console.log(`[Legacy CSV Export] Exporting Host 1 videos with status ${status} using column ${host1StatusColumn}`);
        
        // Get videos without JOIN since we removed the foreign key constraint
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq(host1StatusColumn, status)
            .order('type', { ascending: false }) // Trending first
            .order('score', { ascending: false, nullsFirst: false })
            .order('likes_count', { ascending: false, nullsFirst: false });
            
        if (videosError) {
            res.status(500).json({ error: videosError.message });
            return;
        }
        
        // Get all people to map names
        const { data: people, error: peopleError } = await supabase
            .from('people')
            .select('id, name');
            
        if (peopleError) {
            res.status(500).json({ error: peopleError.message });
            return;
        }
        
        // Create a lookup map for people names
        const peopleMap = {};
        people?.forEach(person => {
            peopleMap[person.id] = person.name;
        });
        
        // Transform the data to include person names
        const rows = videos?.map(video => ({
            ...video,
            added_by_name: peopleMap[video.added_by] || 'Unknown'
        })) || [];
        
        // Convert to CSV
        const headers = ['ID', 'Added By', 'Link', 'Type', 'Likes Count', 'Relevance Rating', 'Score', 'Status', 'Video ID', 'Date Added'];
        const csvRows = [headers.join(',')];
        
        rows.forEach(row => {
            const csvRow = [
                row.id,
                `"${row.added_by_name}"`,
                `"${row.link}"`,
                `"${row.type}"`,
                row.likes_count || 0,
                row.relevance_rating || 0,
                row.score || 0,
                `"${row.status}"`,
                `"${row.video_id_text || ''}"`,
                `"${row.link_added_on}"`
            ];
            csvRows.push(csvRow.join(','));
        });
        
        const csvContent = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${status}_videos.csv"`);
        res.send(csvContent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export all database entries as CSV
app.get('/api/export/all', async (req, res) => {
    try {
        // Get all videos without JOIN since we removed the foreign key constraint
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (videosError) {
            res.status(500).json({ error: videosError.message });
            return;
        }
        
        // Get all people to map names
        const { data: people, error: peopleError } = await supabase
            .from('people')
            .select('*')
            .eq('archived', false);
            
        if (peopleError) {
            res.status(500).json({ error: peopleError.message });
            return;
        }
        
        // Create a map of people by ID
        const peopleMap = {};
        people.forEach(person => {
            peopleMap[person.id] = person.name;
        });
        
        // Create CSV content
        const csvRows = [];
        
        // Header row
        csvRows.push([
            'ID',
            'Person Name',
            'Video Link',
            'Type',
            'Status',
            'Likes Count',
            'Relevance Rating',
            'Score',
            'Video ID Text',
            'Video Code',
            'Created At',
            'Updated At'
        ].map(header => `"${header}"`).join(','));
        
        // Data rows
        videos.forEach(video => {
            const csvRow = [
                `"${video.id || ''}"`,
                `"${peopleMap[video.added_by] || 'Unknown'}"`,
                `"${video.link || ''}"`,
                `"${video.type || ''}"`,
                `"${video.status || ''}"`,
                `"${video.likes_count || 0}"`,
                `"${video.relevance_rating !== null ? video.relevance_rating : ''}"`,
                `"${video.score !== null ? video.score.toFixed(2) : ''}"`,
                `"${video.video_id_text || ''}"`,
                `"${video.video_code || ''}"`,
                `"${video.created_at || ''}"`,
                `"${video.updated_at || ''}"`
            ];
            csvRows.push(csvRow.join(','));
        });
        
        const csvContent = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="all_database_entries.csv"');
        res.send(csvContent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Simple Authentication endpoints

// Login with email and password
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Check if email and password match in admins table
        const { data: admin, error } = await supabase
            .from('admins')
            .select('id, email, name, password')
            .eq('email', email.toLowerCase())
            .eq('password', password)
            .single();
            
        if (error || !admin) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Update last login
        await supabase
            .from('admins')
            .update({ last_login: new Date().toISOString() })
            .eq('id', admin.id);
        
        res.json({ 
            success: true, 
            admin: { 
                id: admin.id, 
                email: admin.email, 
                name: admin.name 
            } 
        });
    } catch (err) {
        console.error('Login failed:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all admins (for admin management)
app.get('/api/admins', async (req, res) => {
    try {
        const { data: admins, error } = await supabase
            .from('admins')
            .select('id, email, name, created_at, last_login')
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('Get admins error:', error);
            return res.status(500).json({ error: 'Failed to fetch admins' });
        }
        
        res.json(admins);
    } catch (err) {
        console.error('Get admins failed:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add new admin
app.post('/api/admins', async (req, res) => {
    try {
        const { email, name, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        const { data: admin, error } = await supabase
            .from('admins')
            .insert([{
                email: email.toLowerCase(),
                name: name || null,
                password: password
            }])
            .select('id, email, name')
            .single();
            
        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(409).json({ error: 'Admin with this email already exists' });
            }
            console.error('Add admin error:', error);
            return res.status(500).json({ error: 'Failed to add admin' });
        }
        
        res.json({ id: admin.id, message: 'Admin added successfully' });
    } catch (err) {
        console.error('Add admin failed:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Remove admin
app.delete('/api/admins/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('admins')
            .delete()
            .eq('id', id);
            
        if (error) {
            console.error('Remove admin error:', error);
            return res.status(500).json({ error: 'Failed to remove admin' });
        }
        
        res.json({ message: 'Admin removed successfully' });
    } catch (err) {
        console.error('Remove admin failed:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Change admin password
app.put('/api/admins/:id/password', async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        
        const { error } = await supabase
            .from('admins')
            .update({ password: password })
            .eq('id', id);
            
        if (error) {
            console.error('Change password error:', error);
            return res.status(500).json({ error: 'Failed to change password' });
        }
        
        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('Change password failed:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Serve main page (protected)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Tags Management Endpoints

// Get all tags
app.get('/api/tags', async (req, res) => {
    try {
        const { data: tags, error } = await supabase
            .from('tags')
            .select('*')
            .order('name');
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json(tags || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new tag
app.post('/api/tags', async (req, res) => {
    try {
        const { name, color } = req.body;
        
        if (!name) {
            res.status(400).json({ error: 'Tag name is required' });
            return;
        }
        
        const { data, error } = await supabase
            .from('tags')
            .insert({ name: name.trim(), color: color || '#007bff' })
            .select()
            .single();
            
        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                res.status(409).json({ error: 'Tag name already exists' });
            } else {
                res.status(500).json({ error: error.message });
            }
            return;
        }
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update tag
app.put('/api/tags/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;
        
        if (!name) {
            res.status(400).json({ error: 'Tag name is required' });
            return;
        }
        
        const { data, error } = await supabase
            .from('tags')
            .update({ name: name.trim(), color: color || '#007bff' })
            .eq('id', id)
            .select()
            .single();
            
        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                res.status(409).json({ error: 'Tag name already exists' });
            } else {
                res.status(500).json({ error: error.message });
            }
            return;
        }
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete tag
app.delete('/api/tags/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('tags')
            .delete()
            .eq('id', id);
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        res.json({ message: 'Tag deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get tags for a specific video
app.get('/api/videos/:id/tags', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: videoTags, error } = await supabase
            .from('video_tags')
            .select(`
                tag_id,
                tags (id, name, color)
            `)
            .eq('video_id', id);
            
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        
        const tags = videoTags?.map(vt => vt.tags) || [];
        res.json(tags);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update tags for a video
app.put('/api/videos/:id/tags', async (req, res) => {
    try {
        const { id } = req.params;
        const { tag_ids } = req.body;
        
        if (!Array.isArray(tag_ids)) {
            res.status(400).json({ error: 'tag_ids must be an array' });
            return;
        }
        
        // Remove existing tags for this video
        const { error: deleteError } = await supabase
            .from('video_tags')
            .delete()
            .eq('video_id', id);
            
        if (deleteError) {
            res.status(500).json({ error: deleteError.message });
            return;
        }
        
        // Add new tags if any
        if (tag_ids.length > 0) {
            const videoTagsData = tag_ids.map(tag_id => ({
                video_id: parseInt(id),
                tag_id: parseInt(tag_id)
            }));
            
            const { error: insertError } = await supabase
                .from('video_tags')
                .insert(videoTagsData);
                
            if (insertError) {
                res.status(500).json({ error: insertError.message });
                return;
            }
        }
        
        res.json({ message: 'Video tags updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
