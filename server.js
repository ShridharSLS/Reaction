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
        const { data, error } = await supabase
            .from('people')
            .select('*')
            .order('name');
            
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
        
        // Check for duplicate URL
        const { data: existingVideo, error: duplicateCheckError } = await supabase
            .from('videos')
            .select('id')
            .eq('link', link)
            .single();
            
        if (existingVideo) {
            res.status(409).json({ error: 'A video with this URL already exists in the system' });
            return;
        }
        
        const { data, error } = await supabase
            .from('videos')
            .insert([{
                added_by: personId,
                link,
                type,
                likes_count: likes_count || 0,
                video_id_text,
                relevance_rating: relevance_rating !== undefined ? relevance_rating : -1,  // Use provided or default to -1
                status: status || 'relevance'    // Use provided status or default to 'relevance'
            }])
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
        const { status, video_id_text } = req.body;
        
        const updateData = { status };
        if (video_id_text !== undefined) {
            updateData.video_id_text = video_id_text;
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

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
