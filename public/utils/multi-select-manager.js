/**
 * MultiSelectManager - Utility class for managing multi-select functionality
 *
 * Following Clean Code principles:
 * - Single Responsibility: Manages selection state and UI updates
 * - DRY: Reusable across different table views
 * - KISS: Simple API for selection management
 * - SOLID: Clear interface, extensible design
 * 
 * Enhanced with:
 * - Proper lifecycle management
 * - Event listener cleanup
 * - Constants-based configuration
 * - Edge case handling
 */

class MultiSelectManager {
    constructor(options = {}) {
        this.selectedIds = new Set();
        this.totalItems = 0;
        this.isDestroyed = false;
        this.boundEventHandlers = new Map(); // Store bound event handlers for cleanup
        
        // Use constants with fallback to options
        const constants = window.APP_CONSTANTS || {};
        this.options = {
            checkboxSelector: constants.SELECTORS?.ROW_CHECKBOX || '.row-checkbox',
            selectAllSelector: constants.SELECTORS?.SELECT_ALL_CHECKBOX || '.select-all-checkbox',
            bulkActionBarSelector: constants.SELECTORS?.BULK_ACTION_BAR || '.bulk-action-bar',
            onSelectionChange: null,
            ...options
        };
        
        this.init();
    }

    /**
     * Initialize event listeners and UI elements
     */
    init() {
        if (this.isDestroyed) {
            console.warn('[MultiSelectManager] Cannot initialize destroyed instance');
            return;
        }
        
        this.attachEventListeners();
        this.updateUI();
    }

    /**
     * Attach event listeners for checkboxes with proper cleanup support
     */
    attachEventListeners() {
        // Individual checkbox change handler
        const individualHandler = (e) => {
            if (e.target.matches(this.options.checkboxSelector)) {
                this.handleIndividualCheckboxChange(e.target);
            }
        };
        
        // Select all checkbox change handler
        const selectAllHandler = (e) => {
            if (e.target.matches(this.options.selectAllSelector)) {
                this.handleSelectAllChange(e.target);
            }
        };
        
        document.addEventListener('change', individualHandler);
        document.addEventListener('change', selectAllHandler);
        
        // Store handlers for cleanup
        this.boundEventHandlers.set('individual', individualHandler);
        this.boundEventHandlers.set('selectAll', selectAllHandler);
    }

    /**
     * Handle individual checkbox change
     * @param {HTMLInputElement} checkbox - The checkbox element
     */
    handleIndividualCheckboxChange(checkbox) {
        if (this.isDestroyed) return;
        
        const id = checkbox.getAttribute('data-video-id');
        if (!id) {
            console.warn('[MultiSelectManager] Checkbox missing data-video-id attribute');
            return;
        }

        if (checkbox.checked) {
            this.selectedIds.add(id);
        } else {
            this.selectedIds.delete(id);
        }

        this.updateUI();
        this.notifySelectionChange();
    }

    /**
     * Handle select all checkbox change
     * @param {HTMLInputElement} selectAllCheckbox - The select all checkbox element
     */
    handleSelectAllChange(selectAllCheckbox) {
        if (this.isDestroyed) return;
        
        const checkboxes = document.querySelectorAll(this.options.checkboxSelector);
        
        if (checkboxes.length === 0) {
            console.warn('[MultiSelectManager] No checkboxes found for select all operation');
            return;
        }

        if (selectAllCheckbox.checked) {
            // Select all
            checkboxes.forEach(checkbox => {
                const id = checkbox.getAttribute('data-video-id');
                if (id) {
                    checkbox.checked = true;
                    this.selectedIds.add(id);
                }
            });
        } else {
            // Deselect all
            checkboxes.forEach(checkbox => {
                const id = checkbox.getAttribute('data-video-id');
                if (id) {
                    checkbox.checked = false;
                    this.selectedIds.delete(id);
                }
            });
        }

        this.updateUI();
        this.notifySelectionChange();
    }

    /**
     * Update UI elements based on current selection
     */
    updateUI() {
        if (this.isDestroyed) return;
        
        const selectAllCheckbox = document.querySelector(this.options.selectAllSelector);
        const bulkActionBar = document.querySelector(this.options.bulkActionBarSelector);
        const checkboxes = document.querySelectorAll(this.options.checkboxSelector);
        
        this.totalItems = checkboxes.length;
        const selectedCount = this.selectedIds.size;

        // Update select all checkbox state
        if (selectAllCheckbox) {
            if (selectedCount === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (selectedCount === this.totalItems) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
        }

        // Show/hide bulk action bar
        if (bulkActionBar) {
            if (selectedCount > 0) {
                bulkActionBar.style.display = 'flex';
                
                // Update selection count display
                const countElement = bulkActionBar.querySelector('.selection-count');
                if (countElement) {
                    countElement.textContent = `${selectedCount} selected`;
                }
            } else {
                bulkActionBar.style.display = 'none';
            }
        }
    }

    /**
     * Notify about selection changes
     */
    notifySelectionChange() {
        if (this.isDestroyed) return;
        
        if (typeof this.options.onSelectionChange === 'function') {
            this.options.onSelectionChange({
                selectedIds: Array.from(this.selectedIds),
                selectedCount: this.selectedIds.size,
                totalItems: this.totalItems
            });
        }
    }

    /**
     * Programmatically select an item
     * @param {string} id - The ID to select
     */
    selectItem(id) {
        if (this.isDestroyed) return;
        
        this.selectedIds.add(id);
        
        // Update corresponding checkbox
        const checkbox = document.querySelector(`${this.options.checkboxSelector}[data-video-id="${id}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }

        this.updateUI();
        this.notifySelectionChange();
    }

    /**
     * Programmatically deselect an item
     * @param {string} id - The ID to deselect
     */
    deselectItem(id) {
        if (this.isDestroyed) return;
        
        this.selectedIds.delete(id);
        
        // Update corresponding checkbox
        const checkbox = document.querySelector(`${this.options.checkboxSelector}[data-video-id="${id}"]`);
        if (checkbox) {
            checkbox.checked = false;
        }

        this.updateUI();
        this.notifySelectionChange();
    }

    /**
     * Get array of selected IDs
     * @returns {string[]} Array of selected IDs
     */
    getSelectedIds() {
        return Array.from(this.selectedIds);
    }

    /**
     * Get selection count
     * @returns {number} Number of selected items
     */
    getSelectedCount() {
        return this.selectedIds.size;
    }

    /**
     * Check if an item is selected
     * @param {string} id - The ID to check
     * @returns {boolean} True if selected
     */
    isSelected(id) {
        return this.selectedIds.has(id);
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        if (this.isDestroyed) return;
        
        this.selectedIds.clear();
        
        // Update all checkboxes
        const checkboxes = document.querySelectorAll(this.options.checkboxSelector);
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Update select all checkbox
        const selectAllCheckbox = document.querySelector(this.options.selectAllSelector);
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }

        this.updateUI();
        this.notifySelectionChange();
    }

    /**
     * Reset the manager state
     */
    reset() {
        if (this.isDestroyed) return;
        
        this.clearSelection();
        this.totalItems = 0;
    }

    /**
     * Update the total items count (useful when table content changes)
     * @param {number} count - New total items count
     */
    updateTotalItems(count) {
        if (this.isDestroyed) return;
        
        this.totalItems = count;
        this.updateUI();
    }

    /**
     * Refresh the UI (useful after DOM changes)
     */
    refresh() {
        if (this.isDestroyed) return;
        
        this.updateUI();
    }

    /**
     * Destroy the manager and clean up event listeners
     */
    destroy() {
        if (this.isDestroyed) return;
        
        // Remove event listeners
        this.boundEventHandlers.forEach((handler, key) => {
            document.removeEventListener('change', handler);
        });
        this.boundEventHandlers.clear();
        
        // Clear selections
        this.selectedIds.clear();
        
        // Mark as destroyed
        this.isDestroyed = true;
        
        console.log('[MultiSelectManager] Destroyed and cleaned up');
    }

    /**
     * Legacy cleanup method for backward compatibility
     */
    cleanup() {
        // Note: Since we use event delegation, no explicit cleanup needed
        // But we can reset state
        this.reset();
    }
}

// Export for use in other modules
window.MultiSelectManager = MultiSelectManager;
