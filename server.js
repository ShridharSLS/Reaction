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
        // Single query to get all videos
        const { data: videos, error } = await supabase
            .from('videos')
            .select('status');
        
        if (error) {
            console.error('Error fetching video counts:', error);
            return res.status(500).json({ error: 'Failed to fetch counts' });
        }
        
        // Count by status
        const counts = {
            relevance: 0,
            pending: 0,
            accepted: 0,
            rejected: 0,
            assigned: 0,
            team: 0,
            all: videos.length
        };
        
        videos.forEach(video => {
            const status = video.status;
            if (status === 'relevance' && video.relevance_rating === -1) {
                counts.relevance++;
            } else if (status === 'pending') {
                counts.pending++;
            } else if (status === 'accepted') {
                counts.accepted++;
            } else if (status === 'rejected') {
                counts.rejected++;
            } else if (status === 'assigned') {
                counts.assigned++;
            } else if (status === 'team') {
                counts.team++;
            }
        });
        
        res.json(counts);
    } catch (error) {
        console.error('Error in /api/videos/counts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get videos by status
app.get('/api/videos/:status', async (req, res) => {
    try {
        const { status } = req.params;
        
        // Get videos without JOIN since we removed the foreign key constraint
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq('status', status)
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
        const transformedData = videos?.map(video => ({
            ...video,
            added_by_name: peopleMap[video.added_by] || 'Unknown'
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
        const videoData = {
            added_by: personId,
            link,
            type,
            likes_count: likes_count || 0,
            video_id_text,
            video_code: videoCode,  // Store extracted video code
            relevance_rating: relevance_rating !== undefined ? relevance_rating : -1,  // Use provided or default to -1
            status: status || 'relevance'    // Use provided status or default to 'relevance'
        };
        
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
            // Check if video is currently in relevance status
            const { data: video } = await supabase
                .from('videos')
                .select('status')
                .eq('id', id)
                .single();
                
            if (video && video.status === 'relevance') {
                updateData.status = 'pending';
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

// Update video status
app.put('/api/videos/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, video_id_text, note } = req.body;
        
        const updateData = { status };
        if (video_id_text !== undefined) {
            updateData.video_id_text = video_id_text;
        }
        if (note !== undefined) {
            updateData.note = note;
        }
        
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

// Export videos to CSV
app.get('/api/videos/:status/export', async (req, res) => {
    try {
        const { status } = req.params;
        
        // Get videos without JOIN since we removed the foreign key constraint
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq('status', status)
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

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
