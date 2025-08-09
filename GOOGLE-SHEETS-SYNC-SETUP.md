# 🔄 Google Sheets Sync Setup Guide

This guide will help you set up automatic periodic synchronization between your Video Topic Review System and Google Sheets.

## 📋 Prerequisites

1. **Google Cloud Project** with Sheets API enabled
2. **Google Sheets** spreadsheet where you want to sync data
3. **Service Account** or **OAuth2 credentials** for API access

## 🚀 Quick Setup Steps

### Step 1: Create Google Cloud Project & Enable API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

### Step 2: Create Service Account (Recommended)

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in service account details and create
4. Click on the created service account
5. Go to "Keys" tab → "Add Key" → "Create New Key" → "JSON"
6. Download the JSON key file

### Step 3: Create Google Sheets

1. Create a new Google Sheets spreadsheet
2. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/1ABC123DEF456/edit
   Spreadsheet ID: 1ABC123DEF456
   ```
3. **Share the spreadsheet** with your service account email:
   - Click "Share" in Google Sheets
   - Add the service account email (found in the JSON key file)
   - Give "Editor" permissions

### Step 4: Configure Environment Variables

1. Copy your `.env.example` to `.env` if you haven't already
2. Update the following variables in your `.env` file:

```bash
# Enable Google Sheets sync
GOOGLE_SHEETS_SYNC_ENABLED=true

# Your Google Sheets ID
GOOGLE_SHEETS_ID=1ABC123DEF456

# Sync interval (in minutes)
SYNC_INTERVAL_MINUTES=30

# Service Account JSON (paste as single line)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project",...}
```

### Step 5: Run Database Migrations

Execute these SQL scripts in your Supabase dashboard:

1. **Create the unified view:**
   ```bash
   # Run the SQL from create-unified-video-view.sql
   ```

2. **Create sync logs table:**
   ```bash
   # Run the SQL from create-sync-logs-table.sql
   ```

### Step 6: Start the Server

```bash
npm start
```

The sync service will automatically start and begin periodic synchronization!

## 🔧 API Endpoints

Once configured, you can use these endpoints:

### Manual Sync Trigger
```bash
POST /api/sync/google-sheets/trigger
```

### Check Sync Status
```bash
GET /api/sync/google-sheets/status
```

### View Sync Logs
```bash
GET /api/sync/logs?type=google_sheets&limit=20
```

### Get Unified Data (JSON)
```bash
GET /api/videos/unified-view
```

### Export CSV
```bash
GET /api/videos/export/csv
```

## 📊 What Gets Synced

The sync includes all video data with:

- **Core Video Data**: ID, link, type, likes, pitch, relevance, score
- **Person Information**: Who added the video
- **Host Data**: Status, notes, and video IDs for all hosts
- **Tags**: Associated tags with names and colors
- **Timestamps**: When statuses were last updated
- **Computed Fields**: Relevance labels, platform detection, days since created

## ⚙️ Configuration Options

### Sync Frequency
Change `SYNC_INTERVAL_MINUTES` in your `.env` file:
- `15` = Every 15 minutes
- `60` = Every hour
- `1440` = Once per day

### Sheet Name
By default, data is written to a sheet named "Video Database". You can modify this in the `GoogleSheetsSync.js` service.

## 🔍 Monitoring & Troubleshooting

### Check Sync Status
```bash
curl http://localhost:3000/api/sync/google-sheets/status
```

### View Recent Sync Logs
```bash
curl http://localhost:3000/api/sync/logs
```

### Common Issues

1. **"Service not available"**
   - Check that `GOOGLE_SHEETS_SYNC_ENABLED=true`
   - Verify service account JSON is valid
   - Ensure Google Sheets API is enabled

2. **"Permission denied"**
   - Make sure the spreadsheet is shared with the service account email
   - Give "Editor" permissions to the service account

3. **"Spreadsheet not found"**
   - Verify the `GOOGLE_SHEETS_ID` is correct
   - Check that the spreadsheet exists and is accessible

## 🎯 Testing the Setup

1. **Manual Sync Test:**
   ```bash
   curl -X POST http://localhost:3000/api/sync/google-sheets/trigger
   ```

2. **Check Your Google Sheet:**
   - Open your Google Sheets
   - Look for the "Video Database" sheet
   - Verify data is populated with headers and video records

3. **Monitor Logs:**
   ```bash
   curl http://localhost:3000/api/sync/logs
   ```

## 🔐 Security Notes

- Keep your service account JSON key secure
- Don't commit the `.env` file to version control
- Use environment variables in production
- Regularly rotate service account keys

## 📈 Advanced Usage

### Custom Sync Logic
Modify `services/GoogleSheetsSync.js` to:
- Change sheet formatting
- Add custom computed fields
- Implement conditional sync logic

### Multiple Sheets
You can extend the service to sync to multiple sheets or different tabs within the same spreadsheet.

### Webhook Integration
Set up webhooks to trigger sync when specific events occur in your system.

---

🎉 **You're all set!** Your video database will now automatically sync to Google Sheets every 30 minutes (or your configured interval).
