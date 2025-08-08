const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { supabase, initializeDatabase, updateScore } = require('./supabase');
const QueryBuilder = require('./query-builder');
const { migrateForNewHost } = require('./schema-utils');

// Safe import of StatusUpdateService
let StatusUpdateService;
try {
  StatusUpdateService = require('./StatusUpdateService');
  console.log('StatusUpdateService loaded successfully');
} catch (error) {
  console.warn('StatusUpdateService not available:', error.message);
  // Fallback implementation for basic functionality
  StatusUpdateService = {
    updateVideoStatus: async (videoId, hostId, status, note, videoIdText, getHostColumns) => {
      const columns = await getHostColumns(hostId);
      const updateData = {};
      updateData[columns.statusColumn] = status;
      if (note !== null && note !== undefined) updateData[columns.noteColumn] = note;
      if (videoIdText !== null && videoIdText !== undefined) updateData[columns.videoIdColumn] = videoIdText;
      
      const { error } = await supabase.from('videos').update(updateData).eq('id', videoId);
      if (error) throw error;
      
      return { success: true, videoId, hostId, status, columns };
    }
  };
}

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Debug logging
console.log('🚀 Server starting...');
console.log('📁 Current directory:', __dirname);
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 Port:', PORT);
console.log('📦 StatusUpdateService available:', !!StatusUpdateService);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Error handling middleware
function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      console.error(`API Error: ${req.method} ${req.path}`, err);

      // Safe error response handling
      const errorMessage = err && err.message ? err.message : 'Internal server error';

      // Only attempt to send response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({ error: errorMessage });
      }
    }
  };
}

// ===== UNIFIED COLUMN ACCESS SYSTEM =====
// Database-driven column mapping for all hosts (DRY implementation)
async function getHostColumns(hostId) {
  try {
    const { data: host, error } = await supabase
      .from('hosts')
      .select('status_column, note_column, video_id_column')
      .eq('host_id', parseInt(hostId))
      .eq('is_active', true)
      .single();

    if (error || !host) {
      throw new Error(`Host ${hostId} not found or inactive`);
    }

    return {
      statusColumn: host.status_column,
      noteColumn: host.note_column,
      videoIdColumn: host.video_id_column,
    };
  } catch (error) {
    console.error(`Error getting columns for host ${hostId}:`, error);
    throw error;
  }
}

// Get all status columns for operations that need to update multiple hosts (now dynamic)
async function getAllStatusColumns() {
  try {
    // Fetch all active hosts from database
    const { data: hosts, error } = await supabase
      .from('hosts')
      .select('host_id, status_column')
      .eq('is_active', true)
      .order('host_id');

    if (error) {
      console.error('Error fetching hosts for status columns:', error);
      // No hardcoded fallback - system must be fully dynamic
      throw new Error('Failed to load host configuration from database. System requires dynamic host management.');
    }

    // Build dynamic status columns object
    const statusColumns = {};
    hosts.forEach(host => {
      statusColumns[`host${host.host_id}`] = host.status_column;
    });

    console.log('[Dynamic Status Columns] Generated for hosts:', Object.keys(statusColumns));
    return statusColumns;
  } catch (error) {
    console.error('Exception in getAllStatusColumns:', error);
    // No hardcoded fallback - system must be fully dynamic
    throw new Error('Failed to load host configuration from database. System requires dynamic host management.');
  }
}

// Get status column for a specific host
function getStatusColumn(hostId) {
  const hostNum = parseInt(hostId);
  return hostNum === 1 ? 'status_1' : `status_${hostNum}`;
}

// Removed unused getNoteColumn function

// Removed unused getVideoIdColumn function

// Get count key for a specific host and status (now fully dynamic for all hosts)
function getCountKey(hostId, status) {
  const hostNum = parseInt(hostId);
  // Use consistent format for ALL hosts: host{id}_{status}
  return `host${hostNum}_${status}`; // e.g., 'host1_pending', 'host2_pending', 'host3_pending'
}

// ===== TAKEN_BY CALCULATION SYSTEM =====
// Functions to calculate and update how many hosts have "taken on" a video

/**
 * Calculate taken_by count for a specific video
 * A host has "taken on" a video if their status is 'accepted' or 'assigned'
 * @param {number} videoId - The video ID
 * @returns {Promise<number>} Count of hosts that have taken on this video
 */
async function calculateTakenBy(videoId) {
  try {
    // Get all active hosts
    const { data: hosts, error: hostsError } = await supabase
      .from('hosts')
      .select('host_id, status_column')
      .eq('is_active', true);
    
    if (hostsError) {
      console.error('[TakenBy] Error fetching hosts:', hostsError);
      return 0;
    }
    
    // Get the video record
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (videoError) {
      console.error('[TakenBy] Error fetching video:', videoError);
      return 0;
    }
    
    let takenCount = 0;
    
    // Check each host's status for this video
    for (const host of hosts) {
      const statusValue = video[host.status_column];
      if (statusValue === 'accepted' || statusValue === 'assigned') {
        takenCount++;
      }
    }
    
    console.log(`[TakenBy] Video ${videoId} taken by ${takenCount} hosts`);
    return takenCount;
    
  } catch (error) {
    console.error('[TakenBy] Error calculating taken_by:', error);
    return 0;
  }
}

/**
 * Update taken_by count for a specific video
 * @param {number} videoId - The video ID to update
 * @returns {Promise<boolean>} Success status
 */
async function updateTakenBy(videoId) {
  try {
    const takenCount = await calculateTakenBy(videoId);
    
    const { error } = await supabase
      .from('videos')
      .update({ taken_by: takenCount })
      .eq('id', videoId);
    
    if (error) {
      console.error('[TakenBy] Error updating taken_by:', error);
      return false;
    }
    
    console.log(`[TakenBy] Updated video ${videoId} taken_by to ${takenCount}`);
    return true;
    
  } catch (error) {
    console.error('[TakenBy] Error in updateTakenBy:', error);
    return false;
  }
}

/**
 * Update taken_by counts for all videos (used for migration/maintenance)
 * @returns {Promise<number>} Number of videos updated
 */
async function updateAllTakenBy() {
  try {
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id');
    
    if (error) {
      console.error('[TakenBy] Error fetching videos for bulk update:', error);
      return 0;
    }
    
    let updatedCount = 0;
    
    for (const video of videos) {
      const success = await updateTakenBy(video.id);
      if (success) updatedCount++;
    }
    
    console.log(`[TakenBy] Bulk update completed: ${updatedCount}/${videos.length} videos updated`);
    return updatedCount;
    
  } catch (error) {
    console.error('[TakenBy] Error in updateAllTakenBy:', error);
    return 0;
  }
}

// Video code extraction function for duplicate detection
function extractVideoCode(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/, // Regular and short URLs
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, // YouTube Shorts
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, // Embedded videos
    /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/, // Mobile URLs
  ];

  // Instagram patterns
  const instagramPatterns = [
    /instagram\.com\/reel\/([a-zA-Z0-9_-]{11})/, // Instagram Reels
    /instagram\.com\/p\/([a-zA-Z0-9_-]{11})/, // Instagram Posts
    /instagram\.com\/stories\/[^/]+\/([a-zA-Z0-9_-]{11})/, // Instagram Stories
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

// Debug: Log all registered routes
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`🛣️  Route: ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
  }
});

initializeDatabase()
  .then(() => {
    console.log('✅ Database initialized successfully');
  })
  .catch((error) => {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  });

// Catch-all route for debugging 404s
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  console.log('📋 Available routes:');
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      console.log(`   ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
    }
  });
  res.status(404).json({ 
    error: 'Route not found', 
    method: req.method, 
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Public Routes
app.get('/submit', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'submit.html'));
});

// API Routes

// Get all people
app.get(
  '/api/people',
  asyncHandler(async (req, res) => {
    const { archived } = req.query;

    let query = supabase.from('people').select('*');

    // Filter by archived status
    if (archived === 'true') {
      query = query.eq('archived', true);
    } else {
      // Default: only show non-archived people
      query = query.eq('archived', false);
    }

    const { data, error } = await query.order('name');

    if (error) {
      console.error('Error fetching people:', error);
      throw error;
    }

    console.log(`Fetched ${data.length} people`);
    res.json(data || []);
  })
);

// Add new person
app.post(
  '/api/people',
  asyncHandler(async (req, res) => {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      console.error('Name is required');
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    // Check for duplicate name
    const existingPerson = await QueryBuilder.findBy('people', 'name', name.trim(), 'id');

    if (existingPerson) {
      console.error('A person with this name already exists');
      res.status(409).json({ error: 'A person with this name already exists' });
      return;
    }

    const data = await QueryBuilder.create('people', { name: name.trim() });

    console.log(`Created new person: ${data.name}`);
    res.status(201).json(data);
  })
);

// Update person name
app.put('/api/people/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await QueryBuilder.updateById('people', id, { name: name.trim() });

    console.log(`Updated person ${id} name to ${name}`);
    res.json({ message: 'Person updated successfully' });
  } catch (err) {
    console.error('Error updating person:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete person
app.delete('/api/people/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete person directly - no need to check for videos since people list is just for form dropdown
    const { error } = await supabase.from('people').delete().eq('id', id);

    if (error) {
      console.error('Error deleting person:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    console.log(`Deleted person ${id}`);
    res.json({ message: 'Person deleted successfully' });
  } catch (err) {
    console.error('Error deleting person:', err);
    res.status(500).json({ error: err.message });
  }
});

// Archive a person
app.put('/api/people/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;

    await QueryBuilder.updateById('people', id, { is_archived: true });

    console.log(`Archived person ${id}`);
    res.json({ message: 'Person archived successfully' });
  } catch (err) {
    console.error('Error archiving person:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unarchive a person
app.put('/api/people/:id/unarchive', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase.from('people').update({ archived: false }).eq('id', id).select().single();

    if (error) {
      console.error('Error unarchiving person:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    console.log(`Unarchived person ${id}`);
    res.json({ message: 'Person unarchived successfully', person: data });
  } catch (err) {
    console.error('Error unarchiving person:', err);
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
    const { data: people, error: peopleError } = await supabase.from('people').select('*');

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
      added_by_name: peopleMap[video.added_by] || 'Unknown',
    }));

    console.log(`Fetched ${videosWithNames.length} videos`);
    res.json(videosWithNames);
  } catch (error) {
    console.error('Error in /api/videos/all/entries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get counts for all video statuses in a single call (performance optimization)
app.get('/api/videos/counts', async (req, res) => {
  try {
    // We now only use relevance_rating for system-wide statuses
    const allStatusColumns = await getAllStatusColumns();
    const selectColumns = Object.values(allStatusColumns).join(', ') + ', relevance_rating';

    console.log(`[Dynamic Counts] Selecting columns: ${selectColumns}`);

    // Single query to get all videos with dynamic column selection
    const { data: videos, error } = await supabase.from('videos').select(selectColumns);

    if (error) {
      console.error('Error fetching video counts:', error);
      return res.status(500).json({ error: 'Failed to fetch counts' });
    }

    // ===== UNIFIED DYNAMIC COUNT SYSTEM =====
    // Generate count keys dynamically for all hosts
    const hostSpecificStatusTypes = ['pending', 'accepted', 'rejected', 'assigned'];
    const hostStatusColumns = await getAllStatusColumns();
    const hostIds = Object.keys(hostStatusColumns).map(key => key.replace('host', ''));

    console.log(`[Dynamic Counts] Generating counts for hosts: ${hostIds.join(', ')}`);

    // Dynamic count initialization for all hosts
    const counts = {
      all: videos.length,
      // System-wide relevance count (new)
      system_relevance: 0,
      // System-wide trash count (new)
      system_trash: 0,
    };

    // Initialize count keys dynamically for all hosts (now without 'relevance' since it's system-wide)
    hostIds.forEach(hostId => {
      hostSpecificStatusTypes.forEach(status => {
        const countKey = getCountKey(parseInt(hostId), status);
        counts[countKey] = 0;
      });
    });

    console.log(
      '[Dynamic Counts] Initialized count keys:',
      Object.keys(counts).filter(key => key !== 'all')
    );

    // Count videos dynamically for all hosts
    videos.forEach(video => {
      // Count system-wide statuses using relevance_rating
      if (video.relevance_rating === -1) {
        counts.system_relevance++;
      } else if (video.relevance_rating === 0) {
        counts.system_trash++;
      }

      // Count host-specific statuses
      hostIds.forEach(hostId => {
        const hostIdNum = parseInt(hostId);
        const statusColumn = getStatusColumn(hostIdNum);
        const videoStatus = video[statusColumn];

        // Only count host-specific statuses now (not relevance)
        if (hostSpecificStatusTypes.includes(videoStatus)) {
          const countKey = getCountKey(hostIdNum, videoStatus);
          counts[countKey]++;
        }
      });
    });

    console.log('[Dynamic Counts] Final counts:', counts);
    res.json(counts);
  } catch (error) {
    console.error('Error in /api/videos/counts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add new video
app.post('/api/videos', async (req, res) => {
  try {
    const { added_by, added_by_name, link, type, likes_count, video_id_text, relevance_rating, status, pitch } =
      req.body;

    let personId = added_by;

    // If added_by_name is provided (legacy admin form), find or create person
    if (added_by_name && !added_by) {
      // First, try to find existing person with this name
      const { data: existingPerson } = await supabase.from('people').select('id').eq('name', added_by_name).single();

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
          console.error('Error creating person:', personError);
          res.status(500).json({ error: 'Failed to create person: ' + personError.message });
          return;
        }

        personId = newPerson.id;
      }
    }

    // For public form submissions, added_by should be provided directly
    if (!personId) {
      console.error('Person selection is required');
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
      console.error('Selected person does not exist');
      res.status(400).json({ error: 'Selected person does not exist' });
      return;
    }

    // Extract video code for smart duplicate detection
    const videoCode = extractVideoCode(link);

    // Check for duplicate using video code (if extractable) or fallback to URL
    let duplicateCheckQuery;
    if (videoCode) {
      // Check by video code first (smart duplicate detection)
      duplicateCheckQuery = supabase.from('videos').select('id, link').eq('video_code', videoCode).single();
    } else {
      // Fallback to URL check for unsupported platforms
      duplicateCheckQuery = supabase.from('videos').select('id, link').eq('link', link).single();
    }

    const { data: existingVideo, error: _duplicateCheckError } = await duplicateCheckQuery;

    if (existingVideo) {
      const errorMessage = videoCode
        ? `This video already exists in the system (found via video ID: ${videoCode}). Existing URL: ${existingVideo.link}`
        : 'A video with this URL already exists in the system';
      console.error(errorMessage);
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
      video_code: videoCode, // Store extracted video code
      relevance_rating: relevance_rating !== undefined ? relevance_rating : -1, // Use provided or default to -1
      pitch: pitch || null, // User-submitted pitch/note
    };

    // START DEBUG - Log input parameters
    console.log('========== VIDEO CREATION DEBUGGING ==========');
    console.log('[DEBUG] Input parameters:', {
      added_by,
      added_by_name,
      link,
      type,
      likes_count,
      video_id_text,
      relevance_rating,
      status,
    });

    // Log initial videoData state before status processing
    console.log('[DEBUG] Initial videoData (before status processing):', JSON.stringify(videoData, null, 2));

    // Handle initial status based on relevance_rating (system-wide approach)
    console.log('[DEBUG] Getting all status columns...');
    const allStatusColumns = await getAllStatusColumns();
    console.log('[DEBUG] Status columns retrieved:', allStatusColumns);

    if (videoData.relevance_rating === -1) {
      // Unrated videos: system-wide relevance view (-1)
      console.log('[DEBUG] Processing video with rating -1 (unrated)');
      // Note: relevance_status no longer used - view determined by rating

      // All host status columns should be null
      Object.values(allStatusColumns).forEach(statusColumn => {
        console.log(`[DEBUG] Setting ${statusColumn} = null`);
        videoData[statusColumn] = null;
      });

      console.log('[System-wide Relevance] New video with rating -1: all host columns=null');
    } else if (videoData.relevance_rating === 0) {
      // Rating 0: system-wide trash view
      console.log('[DEBUG] Processing video with rating 0 (trash)');
      // Note: relevance_status no longer used - view determined by rating

      // All host status columns should be null
      Object.values(allStatusColumns).forEach(statusColumn => {
        console.log(`[DEBUG] Setting ${statusColumn} = null`);
        videoData[statusColumn] = null;
      });

      console.log('[System-wide Trash] New video with rating 0: all host columns=null');
    } else if (videoData.relevance_rating >= 1 && videoData.relevance_rating <= 3) {
      // Rating 1-3: host-specific pending status
      console.log(`[DEBUG] Processing video with rating ${videoData.relevance_rating} (host-specific pending)`);

      // Set all host status columns to pending
      Object.values(allStatusColumns).forEach(statusColumn => {
        console.log(`[DEBUG] Setting ${statusColumn} = 'pending'`);
        videoData[statusColumn] = 'pending';
      });

      console.log(
        `[Host-specific Pending] New video with rating ${videoData.relevance_rating}: all host columns='pending'`
      );
    } else {
      // Fallback for any other ratings: treat as unrated
      console.log('[DEBUG] Processing video with unexpected rating (fallback to unrated)');
      // Force rating to -1 for relevance view
      videoData.relevance_rating = -1;

      Object.values(allStatusColumns).forEach(statusColumn => {
        console.log(`[DEBUG] Setting ${statusColumn} = null`);
        videoData[statusColumn] = null;
      });

      console.log('[Fallback] New video with unexpected rating: forcing to -1 (relevance view)');
    }

    // Log final videoData state that will be inserted
    console.log('[DEBUG] Final videoData to be inserted:', JSON.stringify(videoData, null, 2));

    console.log('[DEBUG] Executing Supabase insert operation...');
    const { data, error } = await supabase.from('videos').insert([videoData]).select().single();

    if (error) {
      console.log('[DEBUG] Error during insert:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    console.log('[DEBUG] Inserted data returned from Supabase:', JSON.stringify(data, null, 2));

    // Additional verification - fetch the record we just inserted to verify all fields
    console.log('[DEBUG] Verifying inserted record...');
    const { data: verifiedData, error: verifyError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', data.id)
      .single();

    if (verifyError) {
      console.log('[DEBUG] Error verifying inserted record:', verifyError);
    } else {
      console.log('[DEBUG] Verified data from database:', JSON.stringify(verifiedData, null, 2));

      // Specifically check host columns
      Object.values(allStatusColumns).forEach(statusColumn => {
        console.log(`[DEBUG] Verified ${statusColumn} = ${verifiedData[statusColumn]}`);
        if (verifiedData[statusColumn] === 'relevance') {
          console.log(`[DEBUG] ERROR: Found 'relevance' in host column ${statusColumn}!`);
        }
      });
    }

    // Calculate initial score
    console.log('[DEBUG] Calculating initial score...');
    await updateScore(data.id);
    console.log('[DEBUG] Score calculation complete');
    console.log('========== END VIDEO CREATION DEBUGGING ==========');

    res.json({ id: data.id, message: 'Video added successfully' });
  } catch (err) {
    console.error('Error adding video:', err);
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
      duplicateCheckQuery = supabase.from('videos').select('id, link').eq('video_code', video_code).single();
    } else if (url) {
      // Fallback to URL check for unsupported platforms
      duplicateCheckQuery = supabase.from('videos').select('id, link').eq('link', url).single();
    } else {
      console.error('Either video_code or url parameter is required');
      res.status(400).json({ error: 'Either video_code or url parameter is required' });
      return;
    }

    const { data: existingVideo, error: _error } = await duplicateCheckQuery;

    if (existingVideo) {
      const errorMessage = video_code
        ? `This video already exists in the system (found via video ID: ${video_code}). Existing URL: ${existingVideo.link}`
        : 'A video with this URL already exists in the system';
      console.error(errorMessage);
      res.status(409).json({ error: errorMessage });
    } else {
      res.json({ isDuplicate: false });
    }
  } catch (err) {
    console.error('Error checking for duplicate video:', err);
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

    // Get all active host status columns for potential updates
    const allStatusColumns = await getAllStatusColumns();

    // Rating -1: Always belongs in Relevance view
    if (relevance_rating === -1) {
      console.log(`[Relevance] Setting video ${id} to relevance view (rating -1)`);

      // Clear ALL host-specific statuses (set to null)
      Object.values(allStatusColumns).forEach(statusColumn => {
        updateData[statusColumn] = null;
      });
    }
    // Rating 0: Always belongs in Trash view
    else if (relevance_rating === 0) {
      console.log(`[Trash] Setting video ${id} to trash view (rating 0)`);

      // Clear ALL host-specific statuses (set to null)
      Object.values(allStatusColumns).forEach(statusColumn => {
        updateData[statusColumn] = null;
      });
    }
    // Ratings 1-3: Video belongs in host-specific pending view
    else if (relevance_rating >= 1 && relevance_rating <= 3) {
      console.log(`[Pending] Setting video ${id} to pending view (rating ${relevance_rating})`);

      // Set all host-specific status columns to 'pending'
      Object.values(allStatusColumns).forEach(statusColumn => {
        updateData[statusColumn] = 'pending';
      });
    }

    const { error } = await supabase.from('videos').update(updateData).eq('id', id);

    if (error) {
      console.error('Error updating video relevance:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    // Update score after relevance change
    await updateScore(id);

    console.log(`Updated video ${id} relevance rating to ${relevance_rating}`);
    res.json({ message: 'Relevance rating updated successfully' });
  } catch (err) {
    console.error('Error updating video relevance:', err);
    res.status(500).json({ error: err.message });
  }
});

// Legacy Host 1 endpoint removed - now using unified /api/videos/:id/host/:hostId/:status endpoint
// All host-specific video updates now use the dynamic host endpoint system

// Legacy Host 2 endpoint removed - now using unified /api/videos/:id/host/:hostId/:status endpoint
// All host-specific video updates now use the dynamic host endpoint system

// ===== UNIFIED GENERIC HOST API ENDPOINT =====
// Update video status for any host (replaces host-specific endpoints)
app.put(
  '/api/videos/:id/host/:hostId/status',
  asyncHandler(async (req, res) => {
    const { id, hostId } = req.params;
    const { status, video_id_text, note } = req.body;

    // Use the centralized StatusUpdateService for consistent timestamp tracking
    const result = await StatusUpdateService.updateVideoStatus(
      id,
      hostId,
      status,
      note,
      video_id_text,
      getHostColumns
    );

    // Note: taken_by is now automatically updated by the database trigger
    // Do not call updateTakenBy manually to avoid infinite recursion
    
    console.log(`Updated video ${id} status for host ${hostId} to ${status}`);
    res.json({
      message: `Host ${hostId} video status updated successfully`,
      hostId: hostId,
      status: status,
      timestamp: result.timestamp,
      columns: result.columns,
      success: result.success
    });
  })
);

// Get status history for a video (useful for audit trails)
app.get(
  '/api/videos/:id/status-history',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const history = await StatusUpdateService.getStatusHistory(id);
    
    console.log(`Fetched status history for video ${id}`);
    res.json({
      message: 'Status history retrieved successfully',
      videoId: id,
      history: history
    });
  })
);

// Bulk status update endpoint (useful for batch operations)
app.put(
  '/api/videos/bulk/status',
  asyncHandler(async (req, res) => {
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      console.error('Updates must be an array');
      return res.status(400).json({ error: 'Updates must be an array' });
    }
    
    const results = await StatusUpdateService.bulkUpdateStatus(updates, getHostColumns);
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    console.log(`Bulk status update completed: ${successCount} successful, ${errorCount} failed`);
    res.json({
      message: `Bulk status update completed: ${successCount} successful, ${errorCount} failed`,
      results: results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: errorCount
      }
    });
  })
);

// Get videos by status for any host (replaces host-specific endpoints)
// System-wide trash endpoint (new endpoint for system-wide trash status)
app.get('/api/videos/system/trash', async (req, res) => {
  try {
    console.log('Fetching system-wide trash videos...');

    // First, get all people to create a name map
    const { data: people, error: peopleError } = await supabase.from('people').select('id, name');

    if (peopleError) {
      console.error('ERROR fetching people:', peopleError);
      return res.status(500).json({ error: 'Failed to fetch people: ' + peopleError.message });
    }

    // Create a map of person_id to person name
    const peopleMap = {};
    people.forEach(person => {
      peopleMap[person.id] = person.name;
    });

    // Get all videos with relevance_rating = 0 (trash)
    const { data: trashVideos, error: trashError } = await supabase
      .from('videos')
      .select('*')
      .eq('relevance_rating', 0)
      .limit(50);

    console.log('Trash query result:', trashError ? 'ERROR' : 'SUCCESS');
    console.log(`Found ${trashVideos ? trashVideos.length : 0} videos with relevance_rating = 0 (trash)`);

    if (trashError) {
      console.error('ERROR in trash query:', trashError);
      return res.status(500).json({ error: 'Failed in trash query: ' + trashError.message });
    }

    // Fetch tags for videos (unified with Host endpoints)
    const videoIds = trashVideos?.map(v => v.id) || [];
    const videoTagsMap = {};

    if (videoIds.length > 0) {
      const { data: videoTags, error: tagsError } = await supabase
        .from('video_tags')
        .select(
          `
                    video_id,
                    tags (
                        id,
                        name,
                        color
                    )
                `
        )
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

    // Format response with proper person names and tags (unified with other endpoints)
    const response = {
      videos: trashVideos.map(video => ({
        ...video,
        // Add person_name from people map (unified with other endpoints)
        added_by_name: peopleMap[video.added_by] || 'Unknown',
        // Add tags from videoTagsMap (unified with Host endpoints)
        tags: videoTagsMap[video.id] || [],
      })),
      status: 'trash',
      count: trashVideos.length,
      isSystemWide: true,
    };

    console.log('Returning trash response with', response.count, 'videos');
    return res.json(response);
  } catch (error) {
    console.error('Error in /api/videos/system/trash:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// System-wide relevance endpoint (new endpoint for system-wide relevance status) - SIMPLIFIED FOR DEBUGGING
app.get('/api/videos/system/relevance', async (req, res) => {
  try {
    console.log('Attempting to fetch system-wide relevance videos (SIMPLIFIED VERSION)...');

    // First try to get any videos at all - most basic query possible
    try {
      const { data: anyVideos, error: anyVideosError } = await supabase.from('videos').select('id').limit(1);

      if (anyVideosError) {
        console.error('CRITICAL ERROR: Cannot access videos table at all:', anyVideosError);
        return res.status(500).json({ error: 'Cannot access videos table: ' + anyVideosError.message });
      }

      console.log('Basic videos query succeeded, found:', anyVideos ? anyVideos.length : 0);
    } catch (basicQueryError) {
      console.error('CRITICAL ERROR: Basic query exception:', basicQueryError);
      return res.status(500).json({ error: 'Exception in basic query: ' + basicQueryError.message });
    }

    // Query for relevance videos using the working approach (fetch people separately)
    try {
      // First, get all people to create a name map
      const { data: people, error: peopleError } = await supabase.from('people').select('id, name');

      if (peopleError) {
        console.error('ERROR fetching people:', peopleError);
        return res.status(500).json({ error: 'Failed to fetch people: ' + peopleError.message });
      }

      // Create a map of person_id to person name
      const peopleMap = {};
      people.forEach(person => {
        peopleMap[person.id] = person.name;
      });

      // Get relevance videos
      const { data: relevanceVideos, error: relevanceError } = await supabase
        .from('videos')
        .select('*')
        .eq('relevance_rating', -1)
        .limit(50);

      console.log('Relevance query result:', relevanceError ? 'ERROR' : 'SUCCESS');
      console.log(`Found ${relevanceVideos ? relevanceVideos.length : 0} videos with relevance_rating = -1`);

      if (relevanceError) {
        console.error('ERROR in relevance query:', relevanceError);
        return res.status(500).json({ error: 'Failed in relevance query: ' + relevanceError.message });
      }

      // Fetch tags for videos (unified with Host endpoints)
      const videoIds = relevanceVideos?.map(v => v.id) || [];
      const videoTagsMap = {};

      if (videoIds.length > 0) {
        const { data: videoTags, error: tagsError } = await supabase
          .from('video_tags')
          .select(
            `
                        video_id,
                        tags (
                            id,
                            name,
                            color
                        )
                    `
          )
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

      // Return results with proper person names and tags (unified with Host endpoints)
      const response = {
        videos: relevanceVideos.map(video => ({
          ...video,
          // Add person_name from people map (unified with other endpoints)
          added_by_name: peopleMap[video.added_by] || 'Unknown',
          // Add tags from videoTagsMap (unified with Host endpoints)
          tags: videoTagsMap[video.id] || [],
        })),
        status: 'relevance',
        count: relevanceVideos.length,
        isSystemWide: true,
      };

      console.log('Returning unified response with', response.count, 'videos');
      return res.json(response);
    } catch (simpleQueryError) {
      console.error('ERROR: Simple query exception:', simpleQueryError);
      return res.status(500).json({ error: 'Exception in simple query: ' + simpleQueryError.message });
    }

    // Note: The code below is no longer reached due to the early return in the try-catch block above
    // Keeping it commented for reference only
    /*
        const response = {
            videos: videos.map(video => ({
                ...video,
                // Add person_name from joined people table
                added_by_name: video.people ? video.people.name : 'Unknown',
            })),
            status: 'relevance',
            count: videos.length,
            isSystemWide: true
        };
        
        res.json(response);
        */
  } catch (error) {
    console.error('Error in /api/videos/system/relevance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get system-wide trash videos (relevance_rating = 0)
app.get('/api/videos/system/trash', async (req, res) => {
  try {
    console.log('Fetching system-wide trash videos...');

    // Use relevance_rating=0 to identify trash videos
    const { data: trashVideos, error: trashError } = await supabase
      .from('videos')
      .select(
        `
                *,
                people!videos_added_by_fkey(name)
            `
      )
      .eq('relevance_rating', 0) // relevance_rating = 0 for trash
      .order('created_at', { ascending: false });

    if (trashError) {
      console.error('Error fetching trash videos:', trashError);
      return res.status(500).json({ error: 'Failed to fetch trash videos: ' + trashError.message });
    }

    console.log(`Found ${trashVideos ? trashVideos.length : 0} trash videos`);

    const response = {
      videos: trashVideos.map(video => ({
        ...video,
        // Add person_name from joined people table
        added_by_name: video.people ? video.people.name : 'Unknown',
      })),
      status: 'trash',
      count: trashVideos.length,
      isSystemWide: true,
    };

    console.log('Returning trash response with', response.count, 'videos');
    res.json(response);
  } catch (error) {
    console.error('Error in /api/videos/system/trash:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
    const { data: people, error: peopleError } = await supabase.from('people').select('id, name');

    if (peopleError) {
      console.error('Error fetching people:', peopleError);
      res.status(500).json({ error: peopleError.message });
      return;
    }

    // Create a lookup map for people names
    const peopleMap = {};
    people.forEach(person => {
      peopleMap[person.id] = person.name;
    });

    // Get all tags for all videos in one query (performance optimization)
    const videoIds = videos?.map(v => v.id) || [];
    const videoTagsMap = {};

    if (videoIds.length > 0) {
      const { data: videoTags, error: tagsError } = await supabase
        .from('video_tags')
        .select(
          `
                    video_id,
                    tags (
                        id,
                        name,
                        color
                    )
                `
        )
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

    // Add person names and tags to videos
    const videosWithNames = videos.map(video => ({
      ...video,
      added_by_name: peopleMap[video.added_by] || 'Unknown',
      tags: videoTagsMap[video.id] || [],
    }));

    console.log(`[Generic API] Found ${videosWithNames.length} videos for host ${hostId}, status ${status}`);

    res.json({
      videos: videosWithNames,
      hostId: hostId,
      status: status,
      statusColumn: statusColumn,
      count: videosWithNames.length,
    });
  } catch (err) {
    console.error('[Generic API] Exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update video note
app.put(
  '/api/videos/:id/note',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { note } = req.body;

    const { error } = await supabase
      .from('videos')
      .update({ note: note || null })
      .eq('id', id);

    if (error) {
      console.error('Error updating video note:', error);
      throw error;
    }

    console.log(`Updated video ${id} note`);
    res.json({ message: 'Note updated successfully' });
  })
);

// Archive/unarchive a person
app.patch(
  '/api/people/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { archived } = req.body;

    if (archived === undefined) {
      console.error('Archived status is required');
      res.status(400).json({ error: 'Archived status is required' });
      return;
    }

    const { data, error } = await supabase
      .from('people')
      .update({ archived: Boolean(archived) })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating person archived status:', error);
      throw error;
    }

    console.log(`Updated person ${id} archived status to ${archived}`);
    res.json(data);
  })
);

// ===== TAKEN_BY MANAGEMENT ENDPOINTS =====

// Update taken_by counts for all videos (maintenance endpoint)
app.post('/api/videos/update-taken-by', asyncHandler(async (req, res) => {
  console.log('[TakenBy API] Starting bulk taken_by update...');
  
  const updatedCount = await updateAllTakenBy();
  
  console.log(`Updated ${updatedCount} videos`);
  res.json({
    message: 'Taken_by counts updated successfully',
    updatedVideos: updatedCount,
    timestamp: new Date().toISOString()
  });
}));

// Get taken_by statistics
app.get('/api/videos/taken-by-stats', asyncHandler(async (req, res) => {
  const { data: stats, error } = await supabase
    .from('videos')
    .select('taken_by')
    .not('taken_by', 'is', null);
  
  if (error) {
    console.error('Error fetching taken_by statistics:', error);
    throw error;
  }
  
  // Calculate statistics
  const takenByDistribution = {};
  let totalVideos = 0;
  let videosWithTaken = 0;
  
  stats.forEach(video => {
    const count = video.taken_by || 0;
    takenByDistribution[count] = (takenByDistribution[count] || 0) + 1;
    totalVideos++;
    if (count > 0) videosWithTaken++;
  });
  
  console.log('Taken_by statistics:', takenByDistribution);
  res.json({
    totalVideos,
    videosWithTaken,
    videosNotTaken: totalVideos - videosWithTaken,
    distribution: takenByDistribution,
    timestamp: new Date().toISOString()
  });
}));

// Get all hosts
app.get(
  '/api/hosts',
  asyncHandler(async (req, res) => {
    // Query parameter for whether to include inactive hosts
    const includeInactive = req.query.include_inactive === 'true';

    let query = supabase.from('hosts').select('*');

    // Only include active hosts unless specifically requested
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    // Order by host_id for consistent display
    const { data, error } = await query.order('host_id');

    if (error) {
      console.error('Error fetching hosts:', error);
      throw error;
    }

    console.log(`Fetched ${data.length} hosts`);
    res.json(data);
  })
);

// Get single host by ID
app.get('/api/hosts/:hostId', async (req, res) => {
  try {
    const { hostId } = req.params;

    const { data: host, error } = await supabase
      .from('hosts')
      .select('*')
      .eq('host_id', parseInt(hostId))
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching host:', error);
      return res.status(404).json({ error: 'Host not found' });
    }

    console.log(`Fetched host ${hostId}`);
    res.json(host);
  } catch (error) {
    console.error('Error in /api/hosts/:hostId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new host with dynamic schema generation
app.post('/api/hosts', async (req, res) => {
  try {
    const { host_id, name, prefix, status_column, note_column, video_id_column, api_path, count_prefix } = req.body;

    // Validate required fields
    if (!host_id || !name || !status_column || !note_column || !video_id_column) {
      console.error('Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if host_id already exists
    const { data: existingHost } = await supabase
      .from('hosts')
      .select('host_id')
      .eq('host_id', parseInt(host_id))
      .single();

    if (existingHost) {
      console.error('Host ID already exists');
      return res.status(400).json({ error: 'Host ID already exists' });
    }

    // Step 1: Create the host record in the database
    const { data: newHost, error } = await supabase
      .from('hosts')
      .insert({
        host_id: parseInt(host_id),
        name,
        prefix: prefix || '',
        status_column,
        note_column,
        video_id_column,
        api_path: api_path || '',
        count_prefix: count_prefix || '',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating host:', error);
      return res.status(500).json({ error: 'Failed to create host' });
    }

    // Step 2: Create the necessary columns in the videos table
    try {
      const migrationResult = await migrateForNewHost({
        host_id: parseInt(host_id),
        status_column,
        note_column,
        video_id_column,
      });

      // Return success with both host data and schema migration details
      console.log(`Created new host ${host_id}`);
      res.status(201).json({
        host: newHost,
        schema: migrationResult,
      });
    } catch (schemaError) {
      console.error('Schema migration failed:', schemaError);

      // The host was created but columns failed - still return 201 but with warning
      console.log(`Created new host ${host_id} but schema migration failed`);
      res.status(201).json({
        host: newHost,
        schema: {
          success: false,
          message: 'Host created but schema migration failed. Manual column creation may be required.',
          error: schemaError.message,
        },
      });
    }
  } catch (error) {
    console.error('Error in POST /api/hosts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update host
app.put('/api/hosts/:hostId', async (req, res) => {
  try {
    const { hostId } = req.params;
    const { name, prefix, status_column, note_column, video_id_column, api_path, count_prefix } = req.body;

    // Validate required fields
    if (!name || !status_column || !note_column || !video_id_column) {
      console.error('Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: updatedHost, error } = await supabase
      .from('hosts')
      .update({
        name,
        prefix: prefix || '',
        status_column,
        note_column,
        video_id_column,
        api_path: api_path || '',
        count_prefix: count_prefix || '',
        updated_at: new Date().toISOString(),
      })
      .eq('host_id', parseInt(hostId))
      .eq('is_active', true)
      .select()
      .single();

    if (error) {
      console.error('Error updating host:', error);
      return res.status(500).json({ error: 'Failed to update host' });
    }

    if (!updatedHost) {
      console.error('Host not found');
      return res.status(404).json({ error: 'Host not found' });
    }

    console.log(`Updated host ${hostId}`);
    res.json(updatedHost);
  } catch (error) {
    console.error('Error in PUT /api/hosts/:hostId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete host (soft delete)
app.delete('/api/hosts/:hostId', async (req, res) => {
  try {
    const { hostId } = req.params;

    // No hardcoded host deletion protection - system is fully dynamic
    // Host deletion protection should be handled by business logic, not hardcoded host IDs

    const { data: deletedHost, error } = await supabase
      .from('hosts')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('host_id', parseInt(hostId))
      .eq('is_active', true)
      .select()
      .single();

    if (error) {
      console.error('Error deleting host:', error);
      return res.status(500).json({ error: 'Failed to delete host' });
    }

    if (!deletedHost) {
      console.error('Host not found');
      return res.status(404).json({ error: 'Host not found' });
    }

    console.log(`Deleted host ${hostId}`);
    res.json({ message: 'Host deleted successfully', host: deletedHost });
  } catch (error) {
    console.error('Error in DELETE /api/hosts/:hostId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🌟 Server running on http://localhost:${PORT}`);
  console.log('📋 Available routes:');
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      console.log(`   ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
    }
  });
});

// Migration endpoint for existing hosts - can be used to add missing columns
app.post('/api/hosts/:hostId/migrate', async (req, res) => {
  try {
    const { hostId } = req.params;
    console.log(`Migration requested for host ${hostId}`);

    // Get the host details
    const { data: host, error } = await supabase.from('hosts').select('*').eq('host_id', parseInt(hostId)).single();

    if (error || !host) {
      return res.status(404).json({ error: 'Host not found' });
    }

    // Run the migration for this host
    const migrationResult = await migrateForNewHost({
      host_id: parseInt(hostId),
      status_column: host.status_column,
      note_column: host.note_column,
      video_id_column: host.video_id_column,
    });

    res.json({
      host,
      schema: migrationResult,
    });
  } catch (error) {
    console.error('Error in migration endpoint:', error);
    res.status(500).json({ error: 'Migration failed: ' + error.message });
  }
});

// Test schema generation without creating a new host
app.post('/api/schema/test', async (req, res) => {
  try {
    // Import test function
    const { testSchemaOperations } = require('./test-schema');

    // Run the schema test
    const result = await testSchemaOperations();

    res.json({
      title: 'Schema Test Results',
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Schema test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Schema test failed: ' + error.message,
    });
  }
});

// ===== VIDEO DELETE ENDPOINTS =====

// Bulk delete videos by IDs (must come before single video delete to avoid routing conflict)
app.delete(
  '/api/videos/bulk',
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs must be provided as a non-empty array' });
    }

    // Validate that all IDs are numbers
    const validIds = ids.filter(id => Number.isInteger(Number(id)));
    if (validIds.length !== ids.length) {
      return res.status(400).json({ error: 'All IDs must be valid integers' });
    }

    // First, delete associated tag relationships for all videos
    const { error: tagError } = await supabase.from('video_tags').delete().in('video_id', validIds);

    if (tagError) {
      throw tagError;
    }

    // Then bulk delete the videos using QueryBuilder
    const deletedVideos = await QueryBuilder.deleteByIds('videos', validIds);

    res.json({
      message: `${deletedVideos.length} video${deletedVideos.length !== 1 ? 's' : ''} deleted successfully`,
      deletedCount: deletedVideos.length,
      deletedVideos: deletedVideos,
    });
  })
);

// Delete video by ID (must come after bulk delete to avoid routing conflict)
app.delete(
  '/api/videos/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // First, delete associated tag relationships
    const { error: tagError } = await supabase.from('video_tags').delete().eq('video_id', id);

    if (tagError) {
      throw tagError;
    }

    // Then delete the video
    const { data, error } = await supabase.from('videos').delete().eq('id', id).select().single();

    if (error) {
      throw error;
    }

    res.json({ message: 'Video deleted successfully', video: data });
  })
);

// ===== TAG MANAGEMENT API ENDPOINTS =====

// Get all tags
app.get(
  '/api/tags',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase.from('tags').select('*').order('name');

    if (error) {
      throw error;
    }
    res.json(data);
  })
);

// Create a new tag
app.post(
  '/api/tags',
  asyncHandler(async (req, res) => {
    const { name, color } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Name and color are required' });
    }

    const { data, error } = await supabase
      .from('tags')
      .insert({ name, color, created_at: new Date().toISOString() })
      .select();

    if (error) {
      throw error;
    }
    res.status(201).json(data[0]);
  })
);

// Update an existing tag
app.put(
  '/api/tags/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, color } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Name and color are required' });
    }

    const { data, error } = await supabase.from('tags').update({ name, color }).eq('id', id).select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json(data[0]);
  })
);

// Delete a tag
app.delete(
  '/api/tags/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // First, remove all associations with videos
    const { error: junctionError } = await supabase.from('video_tags').delete().eq('tag_id', id);

    if (junctionError) {
      throw junctionError;
    }

    // Then delete the tag itself
    const { data, error } = await supabase.from('tags').delete().eq('id', id).select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json({ message: 'Tag deleted successfully', tag: data[0] });
  })
);

// ===== VIDEO TAGS API ENDPOINTS =====

// Get all tags for a video
app.get(
  '/api/videos/:id/tags',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get video tags with tag details in a single query for efficiency
    const { data, error } = await supabase
      .from('video_tags')
      .select(
        `
            tag_id,
            tags (id, name, color)
        `
      )
      .eq('video_id', id);

    if (error) {
      throw error;
    }

    // Transform to a more frontend-friendly format
    const formattedTags = data.map(item => ({
      id: item.tag_id,
      ...item.tags,
    }));

    res.json(formattedTags);
  })
);

// Add tags to a video
app.put(
  '/api/videos/:id/tags',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { tag_ids } = req.body;

    if (!tag_ids || !Array.isArray(tag_ids) || tag_ids.length === 0) {
      return res.status(400).json({ error: 'Tag IDs array is required' });
    }

    // Check if video exists
    const { data: videoData, error: videoError } = await supabase.from('videos').select('id').eq('id', id).single();

    if (videoError || !videoData) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // First, remove existing tags for this video to avoid duplicates
    const { error: deleteError } = await supabase.from('video_tags').delete().eq('video_id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Create tag associations
    const tagAssociations = tag_ids.map(tagId => ({
      video_id: id,
      tag_id: tagId,
      created_at: new Date().toISOString(),
    }));

    const { data: insertData, error: insertError } = await supabase.from('video_tags').insert(tagAssociations).select();

    if (insertError) {
      throw insertError;
    }

    res.status(201).json({
      message: 'Tags updated successfully',
      tags: insertData,
    });
  })
);

// Delete a specific tag from a video
app.delete(
  '/api/videos/:videoId/tags/:tagId',
  asyncHandler(async (req, res) => {
    const { videoId, tagId } = req.params;

    const { data, error } = await supabase
      .from('video_tags')
      .delete()
      .eq('video_id', videoId)
      .eq('tag_id', tagId)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Tag association not found' });
    }

    res.json({
      message: 'Tag removed from video successfully',
      deleted: data[0],
    });
  })
);

module.exports = app;
