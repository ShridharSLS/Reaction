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
    
    try {
        const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error executing raw SQL:', error);
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
        
        if (error) throw error;
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
            videoIdColumn: false
        };
        
        const indexesCreated = {
            statusColumn: false,
            noteColumn: false,
            videoIdColumn: false
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
            indexesCreated
        };
    } catch (error) {
        console.error(`Error adding host columns for host ${hostId}:`, error);
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
        
        // Add the columns for this host
        const result = await addHostColumns(host_id, status_column, note_column, video_id_column);
        
        return {
            success: true,
            message: `Migration completed for host ${host_id}`,
            details: result
        };
    } catch (error) {
        console.error('Migration failed:', error);
        return {
            success: false,
            message: `Migration failed: ${error.message}`,
            error
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
        
        if (error) throw error;
        
        const indexExists = data && data.length > 0 && data[0].exists;
        
        if (!indexExists) {
            await executeRawSql(`
                CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column});
            `);
            console.log(`Created index ${indexName} on ${table}.${column}`);
            return {
                success: true,
                message: `Index ${indexName} created successfully`
            };
        } else {
            console.log(`Index ${indexName} already exists`);
            return {
                success: true,
                message: `Index ${indexName} already exists`,
                noChange: true
            };
        }
    } catch (error) {
        console.error(`Error creating index on ${table}.${column}:`, error);
        throw error;
    }
}

module.exports = {
    migrateForNewHost,
    addHostColumns,
    columnExists,
    executeRawSql,
    createColumnIndex,
    supabaseAdmin
};
