/**
 * Schema Utilities for Dynamic Host Management
 *
 * This module provides functions for dynamically modifying the database schema
 * when adding new hosts. It uses the Supabase service role key to perform
 * ALTER TABLE operations that add required columns for new hosts.
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase client with service role key for schema operations
// The service role key has higher privileges required for DDL operations
let supabaseAdmin;

// Initialize the admin client only if service role key is available
if (supabaseUrl && serviceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
} else {
  console.warn('Missing Supabase URL or Service Role Key. Schema operations will not be available.');
}

/**
 * Execute a raw SQL query with admin privileges
 * This is necessary for ALTER TABLE and other schema operations
 *
 * @param {string} sql - SQL query to execute
 * @returns {Promise} - Query result
 */
async function executeRawSql(sql) {
  if (!supabaseAdmin) {
    throw new Error('Schema operations are not available: missing Supabase service role key');
  }

  // Log the query being executed for debugging
  console.log('Executing SQL query:', sql);

  try {
    // Log key info for debugging (without exposing full key)
    const keyPreview = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(process.env.SUPABASE_SERVICE_ROLE_KEY.length - 5)}`
      : 'NOT SET';
    console.log(`Using service role key (preview): ${keyPreview}`);

    // Check if exec_sql function exists
    try {
      const { data: functionExists, error: functionCheckError } = await supabaseAdmin
        .from('pg_proc')
        .select('proname')
        .eq('proname', 'exec_sql')
        .maybeSingle();

      if (functionCheckError) {
        console.warn('Error checking if exec_sql exists:', functionCheckError);
      } else {
        console.log('exec_sql function exists:', !!functionExists);
      }
    } catch (functionCheckErr) {
      console.warn('Could not verify exec_sql function:', functionCheckErr.message);
    }

    // Execute the SQL via RPC
    console.log('Calling exec_sql RPC function...');
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql });

    if (error) {
      console.error('RPC exec_sql error:', error);
      throw error;
    }

    console.log('SQL execution successful, result:', data);
    return data;
  } catch (error) {
    console.error('Error executing raw SQL:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * Check if a column exists in a table
 *
 * @param {string} table - Table name
 * @param {string} column - Column name
 * @returns {Promise<boolean>} - True if column exists
 */
async function columnExists(table, column) {
  try {
    const sql = `
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = '${table}'
                AND column_name = '${column}'
            ) as exists;
        `;

    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql });

    if (error) {
      throw error;
    }
    return data && data.length > 0 && data[0].exists;
  } catch (error) {
    console.error(`Error checking if column ${column} exists in ${table}:`, error);
    throw error;
  }
}

/**
 * Add host-specific columns to the videos table
 *
 * @param {number} hostId - Host ID
 * @param {string} statusColumn - Status column name
 * @param {string} noteColumn - Note column name
 * @param {string} videoIdColumn - Video ID column name
 * @returns {Promise} - Result of operation
 */
async function addHostColumns(hostId, statusColumn, noteColumn, videoIdColumn) {
  try {
    console.log(`Adding schema columns for host ${hostId}: ${statusColumn}, ${noteColumn}, ${videoIdColumn}`);

    // First check if columns already exist
    const statusExists = await columnExists('videos', statusColumn);
    const noteExists = await columnExists('videos', noteColumn);
    const videoIdExists = await columnExists('videos', videoIdColumn);

    // Track which columns were added and which indexes were created
    const columnsAdded = {
      statusColumn: false,
      noteColumn: false,
      videoIdColumn: false,
    };

    const indexesCreated = {
      statusColumn: false,
      noteColumn: false,
      videoIdColumn: false,
    };

    // Add each column if it doesn't exist
    if (!statusExists) {
      await executeRawSql(`
                ALTER TABLE videos 
                ADD COLUMN ${statusColumn} TEXT DEFAULT 'relevance' 
                CHECK (${statusColumn} IN ('relevance', 'pending', 'accepted', 'rejected', 'assigned'));
            `);
      columnsAdded.statusColumn = true;
      console.log(`Added ${statusColumn} column to videos table`);

      // Create index for the status column (most frequently queried)
      const indexResult = await createColumnIndex('videos', statusColumn);
      indexesCreated.statusColumn = !indexResult.noChange;
    }

    if (!noteExists) {
      await executeRawSql(`
                ALTER TABLE videos 
                ADD COLUMN ${noteColumn} TEXT DEFAULT NULL;
            `);
      columnsAdded.noteColumn = true;
      console.log(`Added ${noteColumn} column to videos table`);
    }

    if (!videoIdExists) {
      await executeRawSql(`
                ALTER TABLE videos 
                ADD COLUMN ${videoIdColumn} TEXT DEFAULT NULL;
            `);
      columnsAdded.videoIdColumn = true;
      console.log(`Added ${videoIdColumn} column to videos table`);

      // Create index for the video_id column (commonly used in lookups)
      const indexResult = await createColumnIndex('videos', videoIdColumn);
      indexesCreated.videoIdColumn = !indexResult.noChange;
    }

    return {
      success: true,
      message: `Schema updated successfully for host ${hostId}`,
      columnsAdded,
      indexesCreated,
    };
  } catch (error) {
    console.error(`Error adding host columns for host ${hostId}:`, error);
    throw error;
  }
}

/**
 * Initialize the status column for a new host by copying appropriate values from Host 1
 * Rules:
 * - Where Host 1 status is 'pending', copy 'pending'
 * - All other statuses (including 'relevance', 'accepted', 'rejected', 'assigned'), set to NULL
 *
 * @param {string} newStatusColumn - The status column name for the new host
 * @returns {Promise} - Result of initialization
 */
async function initializeHostStatusFromHost1(newStatusColumn) {
  try {
    console.log(`Initializing ${newStatusColumn} with values from Host 1 (status_1) - only copying 'pending' status`);

    // Update the new host's status column based on Host 1's status
    // Only copy 'pending', set everything else to NULL
    const updateSql = `
            UPDATE videos 
            SET ${newStatusColumn} = CASE 
                WHEN status_1 = 'pending' THEN 'pending'
                ELSE NULL
            END
            WHERE status_1 IS NOT NULL;
        `;

    await executeRawSql(updateSql);

    // Get count of records updated
    const countSql = `
            SELECT 
                COUNT(*) FILTER (WHERE ${newStatusColumn} = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE ${newStatusColumn} IS NULL AND status_1 IS NOT NULL) as nulled_count,
                COUNT(*) FILTER (WHERE status_1 = 'pending') as source_pending_count
            FROM videos 
            WHERE status_1 IS NOT NULL;
        `;

    const { data: counts } = await supabaseAdmin.rpc('exec_sql', { sql: countSql });

    console.log(`Status initialization complete for ${newStatusColumn}:`, counts);

    return {
      success: true,
      message: `Status column ${newStatusColumn} initialized from Host 1 (only 'pending' copied)`,
      counts: counts && counts.length > 0 ? counts[0] : null,
    };
  } catch (error) {
    console.error(`Error initializing status for ${newStatusColumn}:`, error);
    throw error;
  }
}

/**
 * Create necessary database migration for adding a new host
 *
 * @param {Object} hostData - Host configuration data
 * @returns {Promise} - Result of migration
 */
async function migrateForNewHost(hostData) {
  try {
    const { host_id, status_column, note_column, video_id_column } = hostData;

    if (!host_id || !status_column || !note_column || !video_id_column) {
      throw new Error('Missing required host column information');
    }

    // Step 1: Add the basic columns for this host
    const columnResult = await addHostColumns(host_id, status_column, note_column, video_id_column);

    // Step 2: Add timestamp column for this host
    const timestampColumn = `status_${host_id}_updated_at`;
    const timestampResult = await addTimestampColumn(host_id, timestampColumn);

    // Step 3: Update the trigger to handle this new host
    const triggerResult = await updateStatusTimestampTrigger();

    // Step 4: Initialize the status column with values from Host 1
    let initializationResult = null;
    try {
      initializationResult = await initializeHostStatusFromHost1(status_column);
    } catch (initError) {
      console.warn('Status initialization failed, but continuing:', initError.message);
      initializationResult = {
        success: false,
        message: 'Status initialization failed: ' + initError.message,
        error: initError,
      };
    }

    return {
      success: true,
      message: `Migration completed for host ${host_id} with timestamp support`,
      details: {
        columns: columnResult,
        timestamp: timestampResult,
        trigger: triggerResult,
        initialization: initializationResult,
      },
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      message: `Migration failed: ${error.message}`,
      error,
    };
  }
}

/**
 * Create an index for a column in a table
 *
 * @param {string} table - Table name
 * @param {string} column - Column name
 * @returns {Promise} - Result of operation
 */
async function createColumnIndex(table, column) {
  try {
    const indexName = `idx_${table}_${column}`;

    // Check if index already exists
    const sql = `
            SELECT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE indexname = '${indexName}'
            ) as exists;
        `;

    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql });

    if (error) {
      throw error;
    }

    const indexExists = data && data.length > 0 && data[0].exists;

    if (!indexExists) {
      await executeRawSql(`
                CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column});
            `);
      console.log(`Created index ${indexName} on ${table}.${column}`);
      return {
        success: true,
        message: `Index ${indexName} created successfully`,
      };
    } else {
      console.log(`Index ${indexName} already exists`);
      return {
        success: true,
        message: `Index ${indexName} already exists`,
        noChange: true,
      };
    }
  } catch (error) {
    console.error(`Error creating index on ${table}.${column}:`, error);
    throw error;
  }
}

/**
 * Add timestamp column for a specific host
 *
 * @param {number} hostId - Host ID
 * @param {string} timestampColumn - Timestamp column name (e.g., status_3_updated_at)
 * @returns {Promise} - Result of operation
 */
async function addTimestampColumn(hostId, timestampColumn) {
  try {
    console.log(`Adding timestamp column: ${timestampColumn}`);

    // Check if column already exists
    const exists = await columnExists('videos', timestampColumn);
    if (exists) {
      console.log(`Timestamp column ${timestampColumn} already exists`);
      return {
        success: true,
        message: `Timestamp column ${timestampColumn} already exists`,
        existed: true
      };
    }

    // Add the timestamp column
    const addColumnSql = `
      ALTER TABLE videos 
      ADD COLUMN ${timestampColumn} TIMESTAMP WITH TIME ZONE;
    `;
    
    await executeRawSql(addColumnSql);
    console.log(`Successfully added timestamp column: ${timestampColumn}`);

    // Initialize timestamp values for existing records
    const initializeSql = `
      UPDATE videos 
      SET ${timestampColumn} = created_at
      WHERE ${timestampColumn} IS NULL;
    `;
    
    await executeRawSql(initializeSql);
    console.log(`Initialized timestamp values for existing records`);

    // Create index for performance
    const indexName = `idx_videos_${timestampColumn}`;
    const createIndexSql = `
      CREATE INDEX IF NOT EXISTS ${indexName} ON videos(${timestampColumn});
    `;
    
    await executeRawSql(createIndexSql);
    console.log(`Created index: ${indexName}`);

    return {
      success: true,
      message: `Successfully added timestamp column ${timestampColumn} with index`,
      column: timestampColumn,
      index: indexName
    };

  } catch (error) {
    console.error(`Failed to add timestamp column ${timestampColumn}:`, error);
    return {
      success: false,
      message: `Failed to add timestamp column: ${error.message}`,
      error
    };
  }
}

/**
 * Update the status timestamp trigger to handle all existing status columns dynamically
 * This function recreates the trigger to automatically detect and handle all status_X columns
 *
 * @returns {Promise} - Result of operation
 */
async function updateStatusTimestampTrigger() {
  try {
    console.log('Updating status timestamp trigger for dynamic host support');

    // Step 1: Get all status columns dynamically
    const getStatusColumnsSql = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'videos' 
        AND column_name LIKE 'status_%' 
        AND column_name NOT LIKE '%_updated_at'
      ORDER BY column_name;
    `;
    
    const { data: statusColumns, error: columnsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'videos')
      .like('column_name', 'status_%')
      .not('column_name', 'like', '%_updated_at')
      .order('column_name');

    if (columnsError) {
      throw new Error(`Failed to get status columns: ${columnsError.message}`);
    }

    if (!statusColumns || statusColumns.length === 0) {
      throw new Error('No status columns found');
    }

    console.log('Found status columns:', statusColumns.map(c => c.column_name));

    // Step 2: Generate dynamic trigger function
    const triggerConditions = statusColumns.map(col => {
      const statusCol = col.column_name;
      const timestampCol = `${statusCol}_updated_at`;
      return `
  -- Check if ${statusCol} changed
  IF OLD.${statusCol} IS DISTINCT FROM NEW.${statusCol} THEN
    NEW.${timestampCol} = NOW();
  END IF;`;
    }).join('\n');

    const triggerFunction = `
CREATE OR REPLACE FUNCTION update_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN${triggerConditions}
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
    `;

    // Step 3: Drop existing trigger and function
    const dropTriggerSql = `
      DROP TRIGGER IF EXISTS videos_status_timestamp_trigger ON videos;
      DROP FUNCTION IF EXISTS update_status_timestamp() CASCADE;
    `;
    
    await executeRawSql(dropTriggerSql);
    console.log('Dropped existing trigger and function');

    // Step 4: Create new dynamic trigger function
    await executeRawSql(triggerFunction);
    console.log('Created dynamic trigger function');

    // Step 5: Create new trigger
    const createTriggerSql = `
      CREATE TRIGGER videos_status_timestamp_trigger
        BEFORE UPDATE ON videos
        FOR EACH ROW
        EXECUTE FUNCTION update_status_timestamp();
    `;
    
    await executeRawSql(createTriggerSql);
    console.log('Created new trigger');

    return {
      success: true,
      message: 'Successfully updated status timestamp trigger for dynamic host support',
      statusColumns: statusColumns.map(c => c.column_name),
      triggerFunction: triggerFunction
    };

  } catch (error) {
    console.error('Failed to update status timestamp trigger:', error);
    return {
      success: false,
      message: `Failed to update trigger: ${error.message}`,
      error
    };
  }
}

module.exports = {
  migrateForNewHost,
  addHostColumns,
  addTimestampColumn,
  updateStatusTimestampTrigger,
  columnExists,
  executeRawSql,
  createColumnIndex,
  initializeHostStatusFromHost1,
  supabaseAdmin,
};
