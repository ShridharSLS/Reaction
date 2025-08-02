/**
 * CheckboxColumn - Component for rendering checkbox columns in tables
 *
 * Following Clean Code principles:
 * - Single Responsibility: Handles checkbox column rendering and interactions
 * - DRY: Reusable across different table views
 * - KISS: Simple checkbox column with clear visual feedback
 * - SOLID: Clear interface, extensible for different checkbox needs
 */

class CheckboxColumn {
  constructor(options = {}) {
    this.options = {
      headerCheckboxId: 'select-all-checkbox',
      rowCheckboxClass: 'row-checkbox',
      headerCheckboxClass: 'select-all-checkbox',
      headerLabel: 'Select All',
      ...options,
    };
  }

  /**
   * Render the header checkbox (select all)
   * @returns {string} HTML for header checkbox
   */
  renderHeader() {
    return `
            <th class="checkbox-column-header">
                <div class="checkbox-wrapper">
                    <input 
                        type="checkbox" 
                        id="${this.options.headerCheckboxId}"
                        class="${this.options.headerCheckboxClass}"
                        title="${this.options.headerLabel}"
                    >
                    <label for="${this.options.headerCheckboxId}" class="sr-only">
                        ${this.options.headerLabel}
                    </label>
                </div>
            </th>
        `;
  }

  /**
   * Render a row checkbox
   * @param {number|string} id - Unique identifier for the row
   * @param {boolean} checked - Whether checkbox should be checked
   * @returns {string} HTML for row checkbox
   */
  renderRow(id, checked = false) {
    const checkboxId = `checkbox-${id}`;

    return `
            <td class="checkbox-column-cell">
                <div class="checkbox-wrapper">
                    <input 
                        type="checkbox" 
                        id="${checkboxId}"
                        class="${this.options.rowCheckboxClass}"
                        value="${id}"
                        ${checked ? 'checked' : ''}
                        title="Select row ${id}"
                    >
                    <label for="${checkboxId}" class="sr-only">
                        Select row ${id}
                    </label>
                </div>
            </td>
        `;
  }

  /**
   * Get all selected row IDs from checkboxes
   * @returns {number[]} Array of selected IDs
   */
  getSelectedIds() {
    const checkboxes = document.querySelectorAll(`.${this.options.rowCheckboxClass}:checked`);
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
  }

  /**
   * Get count of selected checkboxes
   * @returns {number} Number of selected checkboxes
   */
  getSelectedCount() {
    const checkboxes = document.querySelectorAll(`.${this.options.rowCheckboxClass}:checked`);
    return checkboxes.length;
  }

  /**
   * Get total count of row checkboxes
   * @returns {number} Total number of row checkboxes
   */
  getTotalCount() {
    const checkboxes = document.querySelectorAll(`.${this.options.rowCheckboxClass}`);
    return checkboxes.length;
  }

  /**
   * Check if all checkboxes are selected
   * @returns {boolean} True if all checkboxes are selected
   */
  isAllSelected() {
    const total = this.getTotalCount();
    const selected = this.getSelectedCount();
    return total > 0 && selected === total;
  }

  /**
   * Check if some (but not all) checkboxes are selected
   * @returns {boolean} True if some checkboxes are selected
   */
  isSomeSelected() {
    const selected = this.getSelectedCount();
    const total = this.getTotalCount();
    return selected > 0 && selected < total;
  }

  /**
   * Select all checkboxes
   */
  selectAll() {
    const checkboxes = document.querySelectorAll(`.${this.options.rowCheckboxClass}`);
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
    });
    this.updateHeaderCheckbox();
  }

  /**
   * Deselect all checkboxes
   */
  deselectAll() {
    const checkboxes = document.querySelectorAll(`.${this.options.rowCheckboxClass}`);
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    this.updateHeaderCheckbox();
  }

  /**
   * Toggle selection of a specific checkbox
   * @param {number|string} id - ID of checkbox to toggle
   */
  toggleSelection(id) {
    const checkbox = document.querySelector(`.${this.options.rowCheckboxClass}[value="${id}"]`);
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      this.updateHeaderCheckbox();
    }
  }

  /**
   * Set selection state for a specific checkbox
   * @param {number|string} id - ID of checkbox to set
   * @param {boolean} selected - Whether checkbox should be selected
   */
  setSelection(id, selected) {
    const checkbox = document.querySelector(`.${this.options.rowCheckboxClass}[value="${id}"]`);
    if (checkbox) {
      checkbox.checked = selected;
      this.updateHeaderCheckbox();
    }
  }

  /**
   * Update header checkbox state based on row selections
   */
  updateHeaderCheckbox() {
    const headerCheckbox = document.querySelector(`.${this.options.headerCheckboxClass}`);
    if (!headerCheckbox) {
      return;
    }

    const selectedCount = this.getSelectedCount();
    const totalCount = this.getTotalCount();

    if (selectedCount === 0) {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = false;
    } else if (selectedCount === totalCount) {
      headerCheckbox.checked = true;
      headerCheckbox.indeterminate = false;
    } else {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = true;
    }
  }

  /**
   * Clear all selections and reset state
   */
  reset() {
    this.deselectAll();

    const headerCheckbox = document.querySelector(`.${this.options.headerCheckboxClass}`);
    if (headerCheckbox) {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = false;
    }
  }

  /**
   * Enable/disable all checkboxes
   * @param {boolean} enabled - Whether checkboxes should be enabled
   */
  setEnabled(enabled) {
    const allCheckboxes = document.querySelectorAll(
      `.${this.options.rowCheckboxClass}, .${this.options.headerCheckboxClass}`
    );

    allCheckboxes.forEach(checkbox => {
      checkbox.disabled = !enabled;
    });
  }

  /**
   * Get selection state information
   * @returns {Object} Selection state object
   */
  getSelectionState() {
    const selectedIds = this.getSelectedIds();
    const selectedCount = selectedIds.length;
    const totalCount = this.getTotalCount();

    return {
      selectedIds,
      selectedCount,
      totalCount,
      hasSelection: selectedCount > 0,
      isAllSelected: selectedCount === totalCount && totalCount > 0,
      isSomeSelected: selectedCount > 0 && selectedCount < totalCount,
    };
  }

  /**
   * Add event listeners for checkbox interactions
   * @param {Function} onSelectionChange - Callback for selection changes
   */
  attachEventListeners(onSelectionChange) {
    // Header checkbox (select all) event listener
    document.addEventListener('change', e => {
      if (e.target.matches(`.${this.options.headerCheckboxClass}`)) {
        if (e.target.checked) {
          this.selectAll();
        } else {
          this.deselectAll();
        }

        if (typeof onSelectionChange === 'function') {
          onSelectionChange(this.getSelectionState());
        }
      }
    });

    // Row checkbox event listener
    document.addEventListener('change', e => {
      if (e.target.matches(`.${this.options.rowCheckboxClass}`)) {
        this.updateHeaderCheckbox();

        if (typeof onSelectionChange === 'function') {
          onSelectionChange(this.getSelectionState());
        }
      }
    });
  }
}

// Export for use in other modules
window.CheckboxColumn = CheckboxColumn;
