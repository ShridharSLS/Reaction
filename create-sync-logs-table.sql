-- ===== SYNC LOGS TABLE CREATION =====
-- Creates a table to track Google Sheets sync status and history
-- Useful for monitoring sync health and debugging issues

-- Drop the table if it exists (for re-running the script)
DROP TABLE IF EXISTS sync_logs;

-- Create sync_logs table
CREATE TABLE sync_logs (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL DEFAULT 'google_sheets',
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'in_progress')),
    details JSONB DEFAULT '{}',
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_synced_at ON sync_logs(synced_at DESC);

-- Add comments for documentation
COMMENT ON TABLE sync_logs IS 'Tracks synchronization operations with external services like Google Sheets';
COMMENT ON COLUMN sync_logs.sync_type IS 'Type of sync operation (google_sheets, etc.)';
COMMENT ON COLUMN sync_logs.status IS 'Status of the sync operation (success, failed, in_progress)';
COMMENT ON COLUMN sync_logs.details IS 'JSON details about the sync operation (records count, errors, etc.)';
COMMENT ON COLUMN sync_logs.synced_at IS 'When the sync operation occurred';

-- Insert initial test record
INSERT INTO sync_logs (sync_type, status, details, synced_at) 
VALUES ('google_sheets', 'success', '{"message": "Sync logs table created successfully"}', NOW());

-- Verification query
SELECT COUNT(*) as total_logs FROM sync_logs;
