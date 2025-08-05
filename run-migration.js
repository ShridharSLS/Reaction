/**
 * Migration Runner Script
 * 
 * This script executes SQL migration files against the Supabase database
 * using the executeRawSql function from schema-utils.js
 */
const fs = require('fs');
const path = require('path');
const { executeRawSql } = require('./schema-utils');
require('dotenv').config();

async function runMigration(filename) {
  try {
    console.log(`Running migration: ${filename}`);
    
    // Read SQL file
    const filePath = path.join(__dirname, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    if (!sql) {
      throw new Error(`Migration file is empty: ${filename}`);
    }
    
    console.log(`Migration SQL loaded (${sql.length} characters)`);
    
    // Execute SQL
    console.log('Executing migration...');
    const result = await executeRawSql(sql);
    
    console.log('Migration completed successfully');
    console.log('Result:', result);
    
    return { success: true, result };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  }
}

// Get migration filename from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file.sql>');
  process.exit(1);
}

// Run migration
runMigration(migrationFile)
  .then(result => {
    if (result.success) {
      console.log(`✅ Migration ${migrationFile} executed successfully`);
      process.exit(0);
    } else {
      console.error(`❌ Migration ${migrationFile} failed:`, result.error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
