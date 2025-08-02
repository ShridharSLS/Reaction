/**
 * NotificationManager - Unified notification and error handling system
 * 
 * Following Clean Code principles:
 * - Single Responsibility: Manages all user notifications consistently
 * - DRY: Eliminates duplicate notification logic
 * - KISS: Simple API for different notification types
 * - SOLID: Extensible design for different notification methods
 */

class NotificationManager {
    constructor() {
        this.defaultDuration = APP_CONSTANTS?.DEFAULTS?.NOTIFICATION_DURATION || 3000;
    }
    
    /**
     * Show success notification
     * @param {string} message - Success message to display
     * @param {number} duration - Duration in milliseconds (optional)
     */
    success(message, duration = this.defaultDuration) {
        // Use existing showSuccessNotification if available, fallback to showNotification
        if (typeof showSuccessNotification === 'function') {
            showSuccessNotification(message);
        } else if (typeof showNotification === 'function') {
            showNotification(message, 'success');
        } else {
            console.log(`✅ SUCCESS: ${message}`);
        }
    }
    
    /**
     * Show error notification
     * @param {string} message - Error message to display
     * @param {Error|string} error - Original error object or string (optional)
     * @param {boolean} useAlert - Whether to use alert() for critical errors
     */
    error(message, error = null, useAlert = false) {
        const fullMessage = error ? `${message}: ${error.message || error}` : message;
        
        if (useAlert) {
            // Use alert for critical errors that need immediate attention
            alert(fullMessage);
        } else if (typeof showNotification === 'function') {
            // Use existing notification system
            showNotification(fullMessage, 'error');
        } else {
            // Fallback to console
            console.error(`❌ ERROR: ${fullMessage}`);
        }
        
        // Always log to console for debugging
        if (error) {
            console.error('Full error details:', error);
        }
    }
    
    /**
     * Show info notification
     * @param {string} message - Info message to display
     */
    info(message) {
        if (typeof showNotification === 'function') {
            showNotification(message, 'info');
        } else {
            console.log(`ℹ️ INFO: ${message}`);
        }
    }
    
    /**
     * Show warning notification
     * @param {string} message - Warning message to display
     */
    warning(message) {
        if (typeof showNotification === 'function') {
            showNotification(message, 'warning');
        } else {
            console.warn(`⚠️ WARNING: ${message}`);
        }
    }
    
    /**
     * Handle bulk delete operation results
     * @param {Object} result - API response from bulk delete
     * @param {number} expectedCount - Expected number of deletions
     */
    handleBulkDeleteResult(result, expectedCount) {
        const deletedCount = result.deletedCount || 0;
        
        if (deletedCount === expectedCount) {
            // Complete success
            this.success(APP_CONSTANTS.MESSAGES.BULK_DELETE.SUCCESS(deletedCount));
        } else if (deletedCount > 0) {
            // Partial success
            this.warning(`Deleted ${deletedCount} of ${expectedCount} videos. Some videos may have already been deleted.`);
        } else {
            // Complete failure
            this.error('No videos were deleted. Please try again.');
        }
    }
    
    /**
     * Handle API errors with context
     * @param {Error} error - API error
     * @param {string} operation - Operation that failed (e.g., 'bulk delete', 'single delete')
     * @param {boolean} isCritical - Whether this is a critical error requiring alert
     */
    handleApiError(error, operation = 'operation', isCritical = false) {
        const message = `Failed to ${operation}`;
        this.error(message, error, isCritical);
    }
    
    /**
     * Show user feedback for edge cases
     * @param {string} caseType - Edge case type
     * @param {Object} context - Additional context (optional)
     */
    handleEdgeCase(caseType, context = {}) {
        switch (caseType) {
            case 'no_selection':
                this.info(APP_CONSTANTS.MESSAGES.BULK_DELETE.NO_SELECTION);
                break;
            case 'empty_result':
                this.warning('No items found to process.');
                break;
            case 'permission_denied':
                this.error('You do not have permission to perform this action.');
                break;
            case 'network_error':
                this.error('Network error. Please check your connection and try again.');
                break;
            default:
                this.warning('Unexpected situation: ' + caseType);
        }
    }
}

// Create singleton instance
const NotificationManager_instance = new NotificationManager();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.NotificationManager = NotificationManager_instance;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager_instance;
}
