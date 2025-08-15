// ===== GOOGLE SHEETS API SYNC SERVICE =====
// Handles periodic synchronization of unified video data to Google Sheets
// Uses Google Sheets API v4 for direct sheet updates

// Node.js compatibility fix for googleapis package
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init) {
      this.headers = new Map();
      if (init) {
        if (typeof init === 'object') {
          for (const [key, value] of Object.entries(init)) {
            this.headers.set(key.toLowerCase(), value);
          }
        }
      }
    }
    
    set(name, value) {
      this.headers.set(name.toLowerCase(), value);
    }
    
    get(name) {
      return this.headers.get(name.toLowerCase());
    }
    
    has(name) {
      return this.headers.has(name.toLowerCase());
    }
    
    delete(name) {
      return this.headers.delete(name.toLowerCase());
    }
    
    append(name, value) {
      const existing = this.get(name);
      if (existing) {
        this.set(name, existing + ', ' + value);
      } else {
        this.set(name, value);
      }
    }
    
    forEach(callback) {
      for (const [key, value] of this.headers) {
        callback(value, key, this);
      }
    }
    
    *[Symbol.iterator]() {
      for (const [key, value] of this.headers) {
        yield [key, value];
      }
    }
  };
}

// Add Blob polyfill for Node.js compatibility
if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(blobParts = [], options = {}) {
      this.size = 0;
      this.type = options.type || '';
      this._parts = [];
      
      for (const part of blobParts) {
        if (typeof part === 'string') {
          const buffer = Buffer.from(part, 'utf8');
          this._parts.push(buffer);
          this.size += buffer.length;
        } else if (Buffer.isBuffer(part)) {
          this._parts.push(part);
          this.size += part.length;
        }
      }
    }
    
    arrayBuffer() {
      return Promise.resolve(Buffer.concat(this._parts).buffer);
    }
    
    text() {
      return Promise.resolve(Buffer.concat(this._parts).toString('utf8'));
    }
    
    stream() {
      const { Readable } = require('stream');
      return Readable.from(this._parts);
    }
  };
}

// Add FormData polyfill for Node.js compatibility
if (typeof global.FormData === 'undefined') {
  global.FormData = class FormData {
    constructor() {
      this._fields = [];
    }
    
    append(name, value, filename) {
      this._fields.push({ name, value, filename });
    }
    
    set(name, value, filename) {
      this.delete(name);
      this.append(name, value, filename);
    }
    
    get(name) {
      const field = this._fields.find(f => f.name === name);
      return field ? field.value : null;
    }
    
    getAll(name) {
      return this._fields.filter(f => f.name === name).map(f => f.value);
    }
    
    has(name) {
      return this._fields.some(f => f.name === name);
    }
    
    delete(name) {
      this._fields = this._fields.filter(f => f.name !== name);
    }
    
    *[Symbol.iterator]() {
      for (const field of this._fields) {
        yield [field.name, field.value];
      }
    }
    
    entries() {
      return this[Symbol.iterator]();
    }
    
    keys() {
      return this._fields.map(f => f.name)[Symbol.iterator]();
    }
    
    values() {
      return this._fields.map(f => f.value)[Symbol.iterator]();
    }
  };
}

// Add ReadableStream polyfill for Node.js compatibility
if (typeof global.ReadableStream === 'undefined') {
  const { Readable } = require('stream');
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource = {}, strategy = {}) {
      this._readable = new Readable({
        read() {
          if (underlyingSource.pull) {
            underlyingSource.pull(this._controller);
          }
        }
      });
      
      this._controller = {
        enqueue: (chunk) => {
          this._readable.push(chunk);
        },
        close: () => {
          this._readable.push(null);
        },
        error: (error) => {
          this._readable.destroy(error);
        }
      };
      
      if (underlyingSource.start) {
        underlyingSource.start(this._controller);
      }
    }
    
    getReader() {
      return {
        read: () => {
          return new Promise((resolve, reject) => {
            this._readable.once('readable', () => {
              const chunk = this._readable.read();
              if (chunk === null) {
                resolve({ done: true, value: undefined });
              } else {
                resolve({ done: false, value: chunk });
              }
            });
            this._readable.once('end', () => {
              resolve({ done: true, value: undefined });
            });
            this._readable.once('error', reject);
          });
        },
        cancel: () => {
          this._readable.destroy();
        }
      };
    }
  };
}

const { google } = require('googleapis');

class GoogleSheetsSync {
    constructor(supabase) {
        this.supabase = supabase;
        this.sheets = null;
        this.auth = null;
        this.syncConfig = {
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            sheetName: 'Video Database',
            syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES) || 30,
            lastSyncTime: null,
            syncEnabled: process.env.GOOGLE_SHEETS_SYNC_ENABLED === 'true'
        };
        
        // Debug logging for environment variables
        console.log('🔧 GoogleSheetsSync Configuration:');
        console.log('  - GOOGLE_SHEETS_ID:', process.env.GOOGLE_SHEETS_ID ? 'Present' : 'Missing');
        console.log('  - GOOGLE_SHEETS_SYNC_ENABLED:', process.env.GOOGLE_SHEETS_SYNC_ENABLED);
        console.log('  - GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Present' : 'Missing');
        console.log('  - GOOGLE_REFRESH_TOKEN:', process.env.GOOGLE_REFRESH_TOKEN ? 'Present' : 'Missing');
        
        if (!this.syncConfig.spreadsheetId) {
            console.warn('⚠️ GOOGLE_SHEETS_ID not found in environment variables!');
        }
        
        this.initializeAuth();
    }

    // Initialize Google Sheets API authentication
    async initializeAuth() {
        try {
            // Support OAuth2 authentication (preferred when service accounts are blocked)
            if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
                // OAuth2 authentication
                this.auth = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET,
                    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
                );
                
                if (process.env.GOOGLE_REFRESH_TOKEN) {
                    this.auth.setCredentials({
                        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
                    });
                    console.log('✅ OAuth2 authentication configured with refresh token');
                } else {
                    console.warn('⚠️ OAuth2 configured but no refresh token found. Manual authorization required.');
                }
            } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                // Service Account authentication (fallback - may be blocked by org policy)
                try {
                    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
                    this.auth = new google.auth.GoogleAuth({
                        credentials: serviceAccount,
                        scopes: ['https://www.googleapis.com/auth/spreadsheets']
                    });
                    console.log('✅ Service Account authentication configured');
                } catch (error) {
                    console.warn('⚠️ Service Account authentication failed (may be blocked by org policy):', error.message);
                    this.auth = null;
                }
            }

            if (this.auth) {
                this.sheets = google.sheets({ version: 'v4', auth: this.auth });
                console.log('✅ Google Sheets API initialized successfully');
            } else {
                console.warn('⚠️ Google Sheets API not configured - sync disabled');
                this.syncConfig.syncEnabled = false;
            }
        } catch (error) {
            console.error('❌ Failed to initialize Google Sheets API:', error);
            this.syncConfig.syncEnabled = false;
        }
    }

    // Get unified data from the SQL view
    async getUnifiedData() {
        try {
            const { data, error } = await this.supabase
                .from('unified_video_view')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                throw new Error(`Failed to fetch unified data: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('❌ Error fetching unified data:', error);
            throw error;
        }
    }

    // Convert data to Google Sheets format
    formatDataForSheets(data) {
        if (!data || data.length === 0) {
            // Row 1: Last sync timestamp in A1, empty cells for the rest
            const timestampRow = [`Last Sync: ${new Date().toLocaleString()}`, ...Array(31).fill('')];
            return [timestampRow, ['No data available']];
        }

        // Row 1: Last sync timestamp in A1, empty cells for the rest
        const timestampRow = [`Last Sync: ${new Date().toLocaleString()}`, ...Array(31).fill('')];

        // Row 2: Headers based on the unified view structure
        const headers = [
            'Video ID',
            'Link',
            'Video Code',
            'Type',
            'Likes Count',
            'Pitch',
            'Relevance Rating',
            'Relevance Label',
            'Score',
            'Taken By',
            'Created At',
            'Link Added On',
            'Added By ID',
            'Added By Name',
            'Host 1 Status',
            'Host 2 Status',
            'Host 3 Status',
            'Host 1 Note',
            'Host 2 Note',
            'Host 3 Note',
            'Host 1 Video ID',
            'Host 2 Video ID',
            'Host 3 Video ID',
            'Host 1 Status Updated',
            'Host 2 Status Updated',
            'Host 3 Status Updated',
            'Tags Count',
            'Tags Names',
            'Tags Colors',
            'Host Status Summary',
            'Days Since Created',
            'Video Platform'
        ];

        // Row 3+: Convert data rows
        const rows = data.map(item => [
            item.id || '',
            item.link || '',
            item.video_code || '',
            item.type || '',
            item.likes_count || '',
            item.pitch || '',
            item.relevance_rating || '',
            item.relevance_label || '',
            item.score || '',
            item.taken_by || '',
            this.formatDate(item.created_at),
            this.formatDate(item.link_added_on),
            item.added_by_id || '',
            item.added_by_name || '',
            item.status_1 || '',
            item.status_2 || '',
            item.status_3 || '',
            item.note_1 || '',
            item.note_2 || '',
            item.note_3 || '',
            item.video_id_1 || '',
            item.video_id_2 || '',
            item.video_id_3 || '',
            this.formatDate(item.status_1_updated_at),
            this.formatDate(item.status_2_updated_at),
            this.formatDate(item.status_3_updated_at),
            item.tags_count || 0,
            item.tags_names || '',
            item.tags_colors || '',
            item.host_status_summary || '',
            item.days_since_created || '',
            item.video_platform || ''
        ]);

        // Return: Row 1 (timestamp), Row 2 (headers), Row 3+ (data)
        return [timestampRow, headers, ...rows];
    }

    // Format date for Google Sheets
    formatDate(dateString) {
        if (!dateString) return '';
        try {
            return new Date(dateString).toISOString().split('T')[0]; // YYYY-MM-DD
        } catch {
            return dateString;
        }
    }

    // Ensure the target sheet exists, or use the first available sheet
    async ensureSheetExists() {
        try {
            // Get spreadsheet metadata to check existing sheets
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.syncConfig.spreadsheetId
            });
            
            const sheets = spreadsheet.data.sheets || [];
            
            // Check if our target sheet exists
            const targetSheet = sheets.find(sheet => 
                sheet.properties.title === this.syncConfig.sheetName
            );
            
            if (targetSheet) {
                console.log(`✅ Using existing sheet: ${this.syncConfig.sheetName}`);
                return this.syncConfig.sheetName;
            }
            
            // If target sheet doesn't exist, use the first available sheet
            if (sheets.length > 0) {
                const firstSheetName = sheets[0].properties.title;
                console.log(`📋 Target sheet '${this.syncConfig.sheetName}' not found, using: ${firstSheetName}`);
                return firstSheetName;
            }
            
            // If no sheets exist (shouldn't happen), create one
            console.log(`🆕 Creating new sheet: ${this.syncConfig.sheetName}`);
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.syncConfig.spreadsheetId,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: this.syncConfig.sheetName
                            }
                        }
                    }]
                }
            });
            
            return this.syncConfig.sheetName;
            
        } catch (error) {
            console.warn(`⚠️ Error checking sheets, using default: ${error.message}`);
            // Fallback to the configured sheet name
            return this.syncConfig.sheetName;
        }
    }

    // Sync data to Google Sheets
    async syncToGoogleSheets() {
        if (!this.syncConfig.syncEnabled || !this.sheets) {
            throw new Error('Google Sheets sync is not enabled or configured');
        }

        try {
            console.log('🔄 Starting Google Sheets sync...');
            
            // Get unified data
            const unifiedData = await this.getUnifiedData();
            console.log(`📊 Fetched ${unifiedData.length} records for sync`);

            // Format data for sheets
            const sheetData = this.formatDataForSheets(unifiedData);
            
            // Ensure the sheet exists or use the first available sheet
            let targetSheetName = await this.ensureSheetExists();
            
            // Clear existing data and update with new data
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.syncConfig.spreadsheetId,
                range: `${targetSheetName}!A:AZ`
            });

            // Write new data
            const response = await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.syncConfig.spreadsheetId,
                range: `${targetSheetName}!A1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: sheetData
                }
            });

            // Update sync status
            this.syncConfig.lastSyncTime = new Date().toISOString();
            
            // Log sync success
            await this.logSyncStatus('success', {
                recordsCount: unifiedData.length,
                updatedCells: response.data.updatedCells,
                updatedRows: response.data.updatedRows
            });

            console.log(`✅ Google Sheets sync completed: ${unifiedData.length} records, ${response.data.updatedCells} cells updated`);
            
            return {
                success: true,
                recordsCount: unifiedData.length,
                updatedCells: response.data.updatedCells,
                updatedRows: response.data.updatedRows,
                syncTime: this.syncConfig.lastSyncTime
            };

        } catch (error) {
            console.error('❌ Google Sheets sync failed:', error);
            
            // Log sync failure
            await this.logSyncStatus('failed', {
                error: error.message
            });
            
            throw error;
        }
    }

    // Log sync status to database
    async logSyncStatus(status, details = {}) {
        try {
            await this.supabase
                .from('sync_logs')
                .insert({
                    sync_type: 'google_sheets',
                    status: status,
                    details: details,
                    synced_at: new Date().toISOString()
                });
        } catch (error) {
            console.error('Failed to log sync status:', error);
            // Don't throw - logging failure shouldn't break sync
        }
    }

    // Get sync status and configuration
    getSyncStatus() {
        return {
            enabled: this.syncConfig.syncEnabled,
            spreadsheetId: this.syncConfig.spreadsheetId,
            sheetName: this.syncConfig.sheetName,
            syncIntervalMinutes: this.syncConfig.syncIntervalMinutes,
            lastSyncTime: this.syncConfig.lastSyncTime,
            nextSyncTime: this.syncConfig.lastSyncTime ? 
                new Date(new Date(this.syncConfig.lastSyncTime).getTime() + 
                        this.syncConfig.syncIntervalMinutes * 60000).toISOString() : null
        };
    }

    // Start periodic sync
    startPeriodicSync() {
        if (!this.syncConfig.syncEnabled) {
            console.log('⚠️ Periodic sync not started - Google Sheets sync is disabled');
            return;
        }

        const intervalMs = this.syncConfig.syncIntervalMinutes * 60 * 1000;
        
        setInterval(async () => {
            try {
                console.log('⏰ Periodic sync triggered');
                await this.syncToGoogleSheets();
            } catch (error) {
                console.error('❌ Periodic sync failed:', error);
            }
        }, intervalMs);

        console.log(`🔄 Periodic Google Sheets sync started (every ${this.syncConfig.syncIntervalMinutes} minutes)`);
    }

    // Manual sync trigger
    async triggerManualSync() {
        console.log('🔄 Manual sync triggered');
        return await this.syncToGoogleSheets();
    }
}

module.exports = GoogleSheetsSync;
