/**
 * Application Constants and Configuration
 * 
 * Centralized configuration for selectors, messages, and other constants
 * Following Clean Code principles: Single source of truth, maintainability
 */

const APP_CONSTANTS = {
    // Multi-select component selectors
    SELECTORS: {
        ROW_CHECKBOX: '.row-checkbox',
        SELECT_ALL_CHECKBOX: '.select-all-checkbox',
        BULK_ACTION_BAR: '.bulk-action-bar',
        BULK_ACTION_CONTAINER: '#bulk-action-container',
        
        // Modal selectors
        CONFIRM_MODAL: '#confirmModal',
        CONFIRM_YES: '#confirmYes',
        CONFIRM_NO: '#confirmNo',
        CONFIRM_TITLE: '#confirmTitle',
        CONFIRM_MESSAGE: '#confirmMessage',
        MODAL_CLOSE: '.close',
        
        // Table selectors
        ALL_ENTRIES_TABLE: '#all-entries-table',
        TABLE_HEADER: 'thead',
        TABLE_BODY: 'tbody'
    },
    
    // CSS classes
    CSS_CLASSES: {
        SELECTED_ROW: 'selected-row',
        BULK_ACTION_BAR: 'bulk-action-bar',
        BULK_ACTION_VISIBLE: 'visible',
        ROW_CHECKBOX: 'row-checkbox',
        SELECT_ALL_CHECKBOX: 'select-all-checkbox',
        LOADING: 'loading'
    },
    
    // Messages and text
    MESSAGES: {
        BULK_DELETE: {
            CONFIRM_TITLE: 'Confirm Bulk Delete',
            CONFIRM_MESSAGE: (count) => `Are you sure you want to delete ${count} selected video${count !== 1 ? 's' : ''}? This action cannot be undone.`,
            SUCCESS: (count) => `Successfully deleted ${count} video${count !== 1 ? 's' : ''}`,
            ERROR: (error) => `Error deleting videos: ${error || 'Unknown error'}`,
            NO_SELECTION: 'Please select videos to delete',
            LOADING: 'Deleting videos...'
        },
        
        SELECTION: {
            COUNT: (count) => `${count} item${count !== 1 ? 's' : ''} selected`,
            SELECT_ALL: 'Select all',
            CLEAR_SELECTION: 'Clear selection'
        }
    },
    
    // API endpoints
    API: {
        VIDEOS_BULK: '/api/videos/bulk',
        VIDEOS_SINGLE: (id) => `/api/videos/${id}`
    },
    
    // Event types
    EVENTS: {
        SELECTION_CHANGE: 'selectionChange',
        BULK_DELETE: 'bulkDelete',
        CLEAR_SELECTION: 'clearSelection'
    },
    
    // Configuration defaults
    DEFAULTS: {
        DEBOUNCE_DELAY: 300,
        NOTIFICATION_DURATION: 3000,
        ANIMATION_DURATION: 200
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.APP_CONSTANTS = APP_CONSTANTS;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = APP_CONSTANTS;
}
