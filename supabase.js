const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize database tables
async function initializeDatabase() {
    try {
        console.log('Checking database tables...');
        
        // Check if tables exist by trying to select from them
        const { data: peopleData, error: peopleError } = await supabase
            .from('people')
            .select('count', { count: 'exact', head: true });
            
        const { data: videosData, error: videosError } = await supabase
            .from('videos')
            .select('count', { count: 'exact', head: true });
        
        if (peopleError || videosError) {
            console.log('Tables need to be created. Please run the SQL setup in Supabase dashboard.');
            console.log('SQL to run in Supabase SQL Editor:');
            console.log(`
-- Create people table
CREATE TABLE IF NOT EXISTS people (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    added_by INTEGER NOT NULL REFERENCES people(id),
    link TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Trending', 'General')),
    link_added_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    likes_count INTEGER,
    relevance_rating INTEGER,
    score INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'assigned')),
    video_id_text VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default people
INSERT INTO people (name) VALUES 
    ('Alice Johnson'),
    ('Bob Smith'),
    ('Carol Davis'),
    ('David Wilson')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_added_by ON videos(added_by);
CREATE INDEX IF NOT EXISTS idx_videos_type ON videos(type);
            `);
        } else {
            console.log('Database tables are ready');
            
            // Check if we need to add default people
            const { data: people, error } = await supabase
                .from('people')
                .select('*');
                
            if (!error && people && people.length === 0) {
                console.log('Adding default people...');
                const { error: insertError } = await supabase
                    .from('people')
                    .insert([
                        { name: 'Alice Johnson' },
                        { name: 'Bob Smith' },
                        { name: 'Carol Davis' },
                        { name: 'David Wilson' }
                    ]);
                    
                if (insertError) {
                    console.error('Error adding default people:', insertError);
                } else {
                    console.log('Default people added successfully');
                }
            }
        }
        
        return true;
    } catch (error) {
        console.error('Database initialization error:', error);
        return false;
    }
}

// Helper function to calculate and update score
async function updateScore(videoId) {
    try {
        const { data: video, error } = await supabase
            .from('videos')
            .select('likes_count, relevance_rating')
            .eq('id', videoId)
            .single();
            
        if (error) {
            console.error('Error fetching video for score update:', error);
            return;
        }
        
        // If relevance_rating is -1 (not rated yet), score should be null
        // If relevance_rating is 0 or higher, calculate score normally
        const score = video.relevance_rating >= 0 ? 
            (video.likes_count || 0) * video.relevance_rating : 
            null;
        
        const { error: updateError } = await supabase
            .from('videos')
            .update({ score })
            .eq('id', videoId);
            
        if (updateError) {
            console.error('Error updating score:', updateError);
        }
    } catch (error) {
        console.error('Score update error:', error);
    }
}

module.exports = {
    supabase,
    initializeDatabase,
    updateScore
};
