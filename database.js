const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'video_review.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create people table
            db.run(`
                CREATE TABLE IF NOT EXISTS people (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL UNIQUE
                )
            `);

            // Create videos table
            db.run(`
                CREATE TABLE IF NOT EXISTS videos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    added_by INTEGER NOT NULL,
                    link TEXT NOT NULL,
                    type TEXT NOT NULL CHECK (type IN ('Trending', 'General')),
                    link_added_on DATETIME DEFAULT CURRENT_TIMESTAMP,
                    likes_count INTEGER,
                    relevance_rating INTEGER,
                    score INTEGER,
                    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'assigned')),
                    video_id_text VARCHAR(255),
                    FOREIGN KEY (added_by) REFERENCES people(id)
                )
            `, (err) => {
                if (err) {
                    reject(err);
                } else {
                    // Insert default people if table is empty
                    db.get("SELECT COUNT(*) as count FROM people", (err, row) => {
                        if (!err && row.count === 0) {
                            const defaultPeople = ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson'];
                            const stmt = db.prepare("INSERT INTO people (name) VALUES (?)");
                            defaultPeople.forEach(name => {
                                stmt.run(name);
                            });
                            stmt.finalize();
                        }
                        resolve();
                    });
                }
            });
        });
    });
}

// Helper function to calculate and update score
function updateScore(videoId, callback) {
    db.get(
        "SELECT likes_count, relevance_rating FROM videos WHERE id = ?",
        [videoId],
        (err, row) => {
            if (err) {
                callback(err);
                return;
            }
            
            const score = (row.likes_count || 0) * (row.relevance_rating || 0);
            db.run(
                "UPDATE videos SET score = ? WHERE id = ?",
                [score, videoId],
                callback
            );
        }
    );
}

module.exports = {
    db,
    initializeDatabase,
    updateScore
};
