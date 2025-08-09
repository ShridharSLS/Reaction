// ===== BULK IMPORT CONFIGURATIONS =====
// Configuration definitions for different bulk import scenarios
// Supports both full bulk import (with relevance) and submit page import (without relevance)

const BULK_IMPORT_CONFIGS = {
    // Full bulk import configuration (existing functionality on main page)
    full: {
        hasRelevance: true,
        minColumns: 4,
        maxColumns: 6,
        columnNames: "Name, Link, Type, Likes, Pitch, Relevance",
        instructions: {
            title: "📋 Bulk Import Video Topics",
            description: `
                <p><strong>Format:</strong> Copy and paste data from Google Sheets with columns:
                <code>Name | Link | Type | Likes count (in thousands) | Pitch (optional) | Relevance (optional)</code>
                <br /><strong>Relevance Logic:</strong> If relevance column is empty → goes to Relevance section (-1). If
                relevance has value (0-3) → goes directly to Pending.
                <br /><strong>Pitch Column:</strong> Optional user note explaining why this video topic would be valuable.
                <br /><strong>Auto-Create People:</strong> New names will be automatically added to the people database - no need to pre-create them!</p>
            `,
            placeholder: `Paste your copied data here...
Example:
John Doe\thttps://youtube.com/watch?v=123\tTrending\t500\tGreat educational content\t2
Jane Smith\thttps://youtube.com/watch?v=456\tGeneral\t200\tFunny and engaging\t
Bob Wilson\thttps://youtube.com/watch?v=789\tTrending\t300\t\t1`
        },
        ui: {
            previewButtonText: "👁️ Preview Data",
            submitButtonText: "📤 Submit All Topics",
            successMessage: "Import Complete"
        }
    },
    
    // Submit page bulk import configuration (new functionality)
    submit: {
        hasRelevance: false,
        minColumns: 4,
        maxColumns: 5,
        columnNames: "Name, Link, Type, Likes, Pitch",
        instructions: {
            title: "📋 Bulk Import Video Topics",
            description: `
                <p><strong>Format:</strong> Copy and paste data from Google Sheets with columns:
                <code>Name | Link | Type | Likes count (in thousands) | Pitch (optional)</code>
                <br /><strong>Auto-Review:</strong> All imported videos will be sent to the relevance review section for evaluation.
                <br /><strong>Pitch Column:</strong> Optional note explaining why this video topic would be valuable.
                <br /><strong>Auto-Create People:</strong> New names will be automatically added to the people database - no need to pre-create them!</p>
            `,
            placeholder: `Paste your copied data here...
Example:
John Doe\thttps://youtube.com/watch?v=123\tTrending\t500\tGreat educational content
Jane Smith\thttps://youtube.com/watch?v=456\tGeneral\t200\tFunny and engaging
Bob Wilson\thttps://youtube.com/watch?v=789\tTrending\t300\tInteresting tech topic`
        },
        ui: {
            previewButtonText: "👁️ Preview Data",
            submitButtonText: "📤 Submit All Topics",
            successMessage: "Import Complete - All videos sent for relevance review"
        }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BULK_IMPORT_CONFIGS;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.BULK_IMPORT_CONFIGS = BULK_IMPORT_CONFIGS;
}
