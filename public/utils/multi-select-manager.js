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
<<<<<<< HEAD
  constructor(options = {}) {
    this.selectedIds = new Set();
    this.totalItems = 0;
    this.options = {
      checkboxSelector: '.row-checkbox',
      selectAllSelector: '.select-all-checkbox',
      bulkActionBarSelector: '.bulk-action-bar',
      onSelectionChange: null,
      ...options,
    };

    this.init();
  }

  /**
   * Initialize event listeners and UI elements
   */
  init() {
    this.attachEventListeners();
    this.updateUI();
  }

  /**
   * Attach event listeners for checkboxes
   */
  attachEventListeners() {
    // Individual checkbox change handler
    document.addEventListener('change', e => {
      if (e.target.matches(this.options.checkboxSelector)) {
        this.handleIndividualCheckboxChange(e.target);
      }
    });

    // Select all checkbox change handler
    document.addEventListener('change', e => {
      if (e.target.matches(this.options.selectAllSelector)) {
        this.handleSelectAllChange(e.target);
      }
    });
  }

  /**
   * Handle individual checkbox change
   * @param {HTMLInputElement} checkbox - The checkbox element
   */
  handleIndividualCheckboxChange(checkbox) {
    const id = parseInt(checkbox.value);

    if (checkbox.checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
=======
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
>>>>>>> 27cece71a39bfe288b83b7d7b6808da8d4f44b01
    }

    this.updateUI();
    this.notifySelectionChange();
  }

  /**
   * Handle select all checkbox change
   * @param {HTMLInputElement} selectAllCheckbox - The select all checkbox
   */
  handleSelectAllChange(selectAllCheckbox) {
    if (selectAllCheckbox.checked) {
      this.selectAll();
    } else {
      this.deselectAll();
    }
<<<<<<< HEAD
  }

  /**
   * Select all items
   */
  selectAll() {
    const checkboxes = document.querySelectorAll(this.options.checkboxSelector);
    checkboxes.forEach(checkbox => {
      const id = parseInt(checkbox.value);
      this.selectedIds.add(id);
      checkbox.checked = true;
    });

    this.updateUI();
    this.notifySelectionChange();
  }

  /**
   * Deselect all items
   */
  deselectAll() {
    this.selectedIds.clear();

    const checkboxes = document.querySelectorAll(this.options.checkboxSelector);
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });

    this.updateUI();
    this.notifySelectionChange();
  }

  /**
   * Toggle selection for a specific ID
   * @param {number} id - Item ID to toggle
   */
  toggleSelection(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }

    // Update corresponding checkbox
    const checkbox = document.querySelector(`${this.options.checkboxSelector}[value="${id}"]`);
    if (checkbox) {
      checkbox.checked = this.selectedIds.has(id);
    }

    this.updateUI();
    this.notifySelectionChange();
  }

  /**
   * Get array of selected IDs
   * @returns {number[]} Array of selected IDs
   */
  getSelectedIds() {
    return Array.from(this.selectedIds);
  }

  /**
   * Get count of selected items
   * @returns {number} Number of selected items
   */
  getSelectedCount() {
    return this.selectedIds.size;
  }

  /**
   * Check if any items are selected
   * @returns {boolean} True if any items are selected
   */
  hasSelection() {
    return this.selectedIds.size > 0;
  }

  /**
   * Check if all items are selected
   * @returns {boolean} True if all items are selected
   */
  isAllSelected() {
    return this.selectedIds.size === this.totalItems && this.totalItems > 0;
  }

  /**
   * Update total items count (call when table data changes)
   * @param {number} count - Total number of items
   */
  updateTotalItems(count) {
    this.totalItems = count;
    this.updateUI();
  }

  /**
   * Update UI elements based on current selection state
   */
  updateUI() {
    this.updateSelectAllCheckbox();
    this.updateBulkActionBar();
  }

  /**
   * Update select all checkbox state
   */
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.querySelector(this.options.selectAllSelector);
    if (!selectAllCheckbox) {
      return;
=======
    
    /**
     * Attach event listeners for checkboxes with proper cleanup tracking
     */
    attachEventListeners() {
        // Create bound event handlers for cleanup
        const individualCheckboxHandler = (e) => {
            if (this.isDestroyed) return;
            if (e.target.matches(this.options.checkboxSelector)) {
                this.handleIndividualCheckboxChange(e.target);
            }
        };
        
        const selectAllHandler = (e) => {
            if (this.isDestroyed) return;
            if (e.target.matches(this.options.selectAllSelector)) {
                this.handleSelectAllChange(e.target);
            }
        };
        
        // Store handlers for cleanup
        this.boundEventHandlers.set('individualCheckbox', individualCheckboxHandler);
        this.boundEventHandlers.set('selectAll', selectAllHandler);
        
        // Attach event listeners
        document.addEventListener('change', individualCheckboxHandler);
        document.addEventListener('change', selectAllHandler);
    }
    
    /**
     * Handle individual checkbox state change
     * @param {HTMLElement} checkbox - The checkbox element that changed
     */
    handleIndividualCheckboxChange(checkbox) {
        if (this.isDestroyed) return;
        
        const videoId = checkbox.getAttribute('data-video-id');
        if (!videoId) {
            console.warn('[MultiSelectManager] Checkbox missing data-video-id attribute');
            return;
        }
        
        if (checkbox.checked) {
            this.selectedIds.add(videoId);
        } else {
            this.selectedIds.delete(videoId);
        }
        
        this.updateUI();
        this.notifySelectionChange();
    }
    
    /**
     * Handle select all checkbox state change
     * @param {HTMLElement} selectAllCheckbox - The select all checkbox element
     */
    handleSelectAllChange(selectAllCheckbox) {
        if (this.isDestroyed) return;
        
        const checkboxes = document.querySelectorAll(this.options.checkboxSelector);
        
        if (checkboxes.length === 0) {
            console.warn('[MultiSelectManager] No checkboxes found for select all operation');
            return;
        }
        
        checkboxes.forEach(checkbox => {
            const videoId = checkbox.getAttribute('data-video-id');
            if (videoId) {
                checkbox.checked = selectAllCheckbox.checked;
                
                if (selectAllCheckbox.checked) {
                    this.selectedIds.add(videoId);
                } else {
                    this.selectedIds.delete(videoId);
                }
            }
        });
        
        this.updateUI();
        this.notifySelectionChange();
>>>>>>> 27cece71a39bfe288b83b7d7b6808da8d4f44b01
    }

    if (this.selectedIds.size === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (this.isAllSelected()) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }
  }

  /**
   * Update bulk action bar visibility and content
   */
  updateBulkActionBar() {
    const bulkActionBar = document.querySelector(this.options.bulkActionBarSelector);
    if (!bulkActionBar) {
      return;
    }

    if (this.hasSelection()) {
      bulkActionBar.style.display = 'flex';
      this.updateSelectionCounter();
    } else {
      bulkActionBar.style.display = 'none';
    }
  }

  /**
   * Update selection counter in bulk action bar
   */
  updateSelectionCounter() {
    const counter = document.querySelector('.selection-counter');
    if (counter) {
      const count = this.getSelectedCount();
      counter.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
    }
<<<<<<< HEAD
  }

  /**
   * Notify selection change callback
   */
  notifySelectionChange() {
    if (typeof this.options.onSelectionChange === 'function') {
      this.options.onSelectionChange({
        selectedIds: this.getSelectedIds(),
        selectedCount: this.getSelectedCount(),
        hasSelection: this.hasSelection(),
        isAllSelected: this.isAllSelected(),
      });
=======
    
    /**
     * Get count of selected items
     * @returns {number} Number of selected items
     */
    getSelectedCount() {
        return this.selectedIds.size;
    }
    
    /**
     * Check if any items are selected
     * @returns {boolean} True if any items are selected
     */
    hasSelection() {
        return this.selectedIds.size > 0;
    }
    
    /**
     * Check if all items are selected
     * @returns {boolean} True if all items are selected
     */
    isAllSelected() {
        return this.selectedIds.size === this.totalItems && this.totalItems > 0;
    }
    
    /**
     * Update total items count (call when table data changes)
     * @param {number} count - Total number of items
     */
    updateTotalItems(count) {
        this.totalItems = count;
        this.updateUI();
    }
    
    /**
     * Update UI elements based on current selection state
     */
    updateUI() {
        this.updateSelectAllCheckbox();
        this.updateBulkActionBar();
    }
    
    /**
     * Update select all checkbox state
     */
    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.querySelector(this.options.selectAllSelector);
        if (!selectAllCheckbox) return;
        
        if (this.selectedIds.size === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (this.isAllSelected()) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
    
    /**
     * Update bulk action bar visibility and content
     */
    updateBulkActionBar() {
        const bulkActionBar = document.querySelector(this.options.bulkActionBarSelector);
        if (!bulkActionBar) return;
        
        if (this.hasSelection()) {
            bulkActionBar.style.display = 'flex';
            this.updateSelectionCounter();
        } else {
            bulkActionBar.style.display = 'none';
        }
    }
    
    /**
     * Update selection counter in bulk action bar
     */
    updateSelectionCounter() {
        const counter = document.querySelector('.selection-counter');
        if (counter) {
            const count = this.getSelectedCount();
            counter.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
        }
    }
    
    /**
     * Notify selection change callback
     */
    notifySelectionChange() {
        if (typeof this.options.onSelectionChange === 'function') {
            this.options.onSelectionChange({
                selectedIds: this.getSelectedIds(),
                selectedCount: this.getSelectedCount(),
                hasSelection: this.hasSelection(),
                isAllSelected: this.isAllSelected()
            });
        }
    }
    
    /**
     * Reset selection state (useful after bulk operations)
     */
    reset() {
        if (this.isDestroyed) return;
        
        this.selectedIds.clear();
        this.updateUI();
        this.notifySelectionChange();
    }
    
    /**
     * Destroy the manager and clean up all event listeners
     * Call this when the component is no longer needed to prevent memory leaks
     */
    destroy() {
        if (this.isDestroyed) return;
        
        // Remove all event listeners
        this.boundEventHandlers.forEach((handler, key) => {
            document.removeEventListener('change', handler);
        });
        
        // Clear all references
        this.boundEventHandlers.clear();
        this.selectedIds.clear();
        this.options.onSelectionChange = null;
        
        // Mark as destroyed
        this.isDestroyed = true;
        
        console.log('[MultiSelectManager] Destroyed and cleaned up');
    }
    
    /**
     * Check if the manager has been destroyed
     * @returns {boolean} True if destroyed
     */
    getIsDestroyed() {
        return this.isDestroyed;
>>>>>>> 27cece71a39bfe288b83b7d7b6808da8d4f44b01
    }
  }

  /**
   * Reset selection state (useful after bulk operations)
   */
  reset() {
    this.selectedIds.clear();
    this.totalItems = 0;

    // Clear all checkboxes
    const checkboxes = document.querySelectorAll(this.options.checkboxSelector);
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });

    this.updateUI();
    this.notifySelectionChange();
  }

  /**
   * Destroy the manager and clean up event listeners
   */
  destroy() {
    // Note: Since we use event delegation, no explicit cleanup needed
    // But we can reset state
    this.reset();
  }
}

// Export for use in other modules
window.MultiSelectManager = MultiSelectManager;
