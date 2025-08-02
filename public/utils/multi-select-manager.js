/**
 * MultiSelectManager - Utility class for managing multi-select functionality
 *
 * Following Clean Code principles:
 * - Single Responsibility: Manages selection state and UI updates
 * - DRY: Reusable across different table views
 * - KISS: Simple API for selection management
 * - SOLID: Clear interface, extensible design
 */

class MultiSelectManager {
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
