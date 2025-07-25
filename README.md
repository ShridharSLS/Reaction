# 🌊 Video Topic Review System

A comprehensive workflow application for managing video submissions through different review stages. Built with Node.js, Express, Supabase (PostgreSQL), and vanilla JavaScript. Deployed on Vercel with live database integration.

## 🚀 Features

- **Manual Data Entry**: All video information is manually input (no scraping)
- **Status-Based Workflow**: Videos progress through `pending` → `accepted` → `assigned` stages
- **Automatic Score Calculation**: Score = Likes Count × Relevance Rating
- **Admin Dashboard**: Complete management interface with multiple views
- **CSV Export**: Export any view to CSV format
- **Confirmation Dialogs**: All status changes require confirmation
- **Responsive Design**: Works on desktop and mobile devices

## 📋 Database Schema

### People Table
- `id` - Primary key
- `name` - Person's name (unique)

### Videos Table
- `id` - Primary key
- `added_by` - Foreign key to people table
- `link` - Video URL
- `type` - 'Trending' or 'General'
- `link_added_on` - Timestamp (auto-generated)
- `likes_count` - Number of likes
- `relevance_rating` - Rating from 1-10
- `score` - Auto-calculated (likes_count × relevance_rating)
- `status` - 'pending', 'accepted', 'rejected', or 'assigned'
- `video_id_text` - Video ID (required when assigned)

## 🔄 Workflow

1. **Submit Video**: Add new video with person, link, type, and likes count
2. **Pending Review**: Admin assigns relevance rating and accepts/rejects
3. **Accepted**: Admin can assign video ID to move to final stage
4. **Assigned**: Final stage with all information complete
5. **Rejected**: Archived videos that can be reverted or deleted

## 🛠️ Installation & Setup

### Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Start the Server**:
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

3. **Access the Application**:
   Open your browser and go to `http://localhost:3000`

## 📊 Views & Features

### 🟡 Pending Videos
- View all submitted videos awaiting review
- Edit relevance ratings (auto-updates score)
- Accept or reject videos
- Delete unwanted submissions

### ✅ Accepted Videos
- View accepted videos ready for ID assignment
- Assign video IDs to move to final stage
- Revert to pending if needed

### 🟥 Rejected Videos
- Archive of rejected videos
- Option to revert to pending
- Permanent deletion available

### 🆔 ID Assigned Videos
- Final stage with complete information
- Read-only view of all data
- Option to revert to accepted stage

### 👥 Manage People
- Add new people who can submit videos
- View all registered people

## 🎯 Sorting & Display

Videos are automatically sorted by:
1. **Type**: Trending videos appear first
2. **Score**: Highest scores first
3. **Date**: Most recent submissions first

## 📤 Export Features

- Export any view to CSV format
- Includes all relevant fields for the selected status
- Downloadable files with proper formatting

## 🔧 API Endpoints

- `GET /api/people` - Get all people
- `POST /api/people` - Add new person
- `GET /api/videos/:status` - Get videos by status
- `POST /api/videos` - Add new video
- `PUT /api/videos/:id/relevance` - Update relevance rating
- `PUT /api/videos/:id/status` - Update video status
- `DELETE /api/videos/:id` - Delete video
- `GET /api/export/:status` - Export videos to CSV

## 🎨 UI Features

- **Modern Design**: Clean, responsive interface with gradient backgrounds
- **Status Indicators**: Color-coded cards and badges
- **Confirmation Dialogs**: All destructive actions require confirmation
- **Real-time Updates**: Scores update automatically when relevance changes
- **Mobile Friendly**: Responsive design works on all devices

## 🔒 Data Management

- **SQLite Database**: Lightweight, file-based database
- **Automatic Initialization**: Database and tables created on first run
- **Sample Data**: Default people added for immediate testing
- **Data Integrity**: Foreign key constraints and validation

## 🚦 Getting Started

1. Start the application
2. Go to "Manage People" to add team members
3. Use "Add Topic" to submit video links
4. Review submissions in "Pending" tab
5. Move videos through the workflow stages
6. Export data as needed

## 📝 Notes

- All data entry is manual - no automatic scraping
- Score calculation happens automatically when relevance is set
- Videos can be reverted between stages as needed
- CSV exports include all relevant data for each status
- Confirmation dialogs prevent accidental actions
