/**
 * BulkActionBar - Component for bulk actions UI
 * 
 * Following Clean Code principles:
 * - Single Responsibility: Manages bulk action UI and interactions
 * - DRY: Reusable across different views that need bulk operations
 * - KISS: Simple, intuitive bulk action interface
 * - SOLID: Clear interface, extensible for different bulk operations
 */

class BulkActionBar {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.options = {
            showDeleteButton: true,
            showClearButton: true,
            position: 'top', // 'top' or 'bottom'
            onDelete: null,
            onClear: null,
            ...options
        };
        
        this.isVisible = false;
        this.isLoading = false;
        
        this.init();
    }
    
    /**
     * Initialize the bulk action bar
     */
    init() {
        this.render();
        this.attachEventListeners();
    }
    
    /**
     * Render the bulk action bar HTML
     */
    render() {
        if (!this.container) {
            console.error('BulkActionBar: Container not found');
            return;
        }
        
        const bulkActionBarHtml = `
            <div class="bulk-action-bar" style="display: none;">
                <div class="bulk-action-content">
                    <div class="bulk-action-left">
                        <span class="selection-counter">0 items selected</span>
                    </div>
                    <div class="bulk-action-right">
                        ${this.options.showClearButton ? `
                            <button type="button" class="btn btn-secondary btn-clear-selection">
                                Clear Selection
                            </button>
                        ` : ''}
                        ${this.options.showDeleteButton ? `
                            <button type="button" class="btn btn-danger btn-bulk-delete">
                                <span class="btn-text">Delete Selected</span>
                                <span class="btn-loading" style="display: none;">
                                    <i class="fas fa-spinner fa-spin"></i> Deleting...
                                </span>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = bulkActionBarHtml;
        this.bulkActionBar = this.container.querySelector('.bulk-action-bar');
    }
    
    /**
     * Attach event listeners to bulk action buttons
     */
    attachEventListeners() {
        if (!this.bulkActionBar) return;
        
        // Clear selection button
        const clearButton = this.bulkActionBar.querySelector('.btn-clear-selection');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.handleClearSelection();
            });
        }
        
        // Bulk delete button
        const deleteButton = this.bulkActionBar.querySelector('.btn-bulk-delete');
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                this.handleBulkDelete();
            });
        }
    }
    
    /**
     * Handle clear selection button click
     */
    handleClearSelection() {
        if (typeof this.options.onClear === 'function') {
            this.options.onClear();
        }
    }
    
    /**
     * Handle bulk delete button click
     */
    async handleBulkDelete() {
        if (this.isLoading) return;
        
        if (typeof this.options.onDelete === 'function') {
            await this.options.onDelete();
        }
    }
    
    /**
     * Show the bulk action bar
     */
    show() {
        if (this.bulkActionBar) {
            this.bulkActionBar.style.display = 'flex';
            this.isVisible = true;
        }
    }
    
    /**
     * Hide the bulk action bar
     */
    hide() {
        if (this.bulkActionBar) {
            this.bulkActionBar.style.display = 'none';
            this.isVisible = false;
        }
    }
    
    /**
     * Update the selection counter
     * @param {number} count - Number of selected items
     */
    updateCounter(count) {
        const counter = this.bulkActionBar?.querySelector('.selection-counter');
        if (counter) {
            counter.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
        }
    }
    
    /**
     * Set loading state for bulk operations
     * @param {boolean} loading - Whether operation is loading
     */
    setLoading(loading) {
        this.isLoading = loading;
        
        const deleteButton = this.bulkActionBar?.querySelector('.btn-bulk-delete');
        if (!deleteButton) return;
        
        const btnText = deleteButton.querySelector('.btn-text');
        const btnLoading = deleteButton.querySelector('.btn-loading');
        
        if (loading) {
            deleteButton.disabled = true;
            deleteButton.classList.add('loading');
            if (btnText) btnText.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'inline-block';
        } else {
            deleteButton.disabled = false;
            deleteButton.classList.remove('loading');
            if (btnText) btnText.style.display = 'inline-block';
            if (btnLoading) btnLoading.style.display = 'none';
        }
    }
    
    /**
     * Update bulk action bar based on selection state
     * @param {Object} selectionState - Current selection state
     */
    updateState(selectionState) {
        const { selectedCount, hasSelection } = selectionState;
        
        if (hasSelection) {
            this.show();
            this.updateCounter(selectedCount);
        } else {
            this.hide();
        }
    }
    
    /**
     * Enable/disable bulk action buttons
     * @param {boolean} enabled - Whether buttons should be enabled
     */
    setEnabled(enabled) {
        const buttons = this.bulkActionBar?.querySelectorAll('button');
        if (buttons) {
            buttons.forEach(button => {
                button.disabled = !enabled;
            });
        }
    }
    
    /**
     * Add custom bulk action button
     * @param {Object} buttonConfig - Button configuration
     */
    addCustomButton(buttonConfig) {
        const { text, className = 'btn btn-secondary', onClick, position = 'right' } = buttonConfig;
        
        if (!this.bulkActionBar) return;
        
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = text;
        button.addEventListener('click', onClick);
        
        const targetContainer = position === 'left' 
            ? this.bulkActionBar.querySelector('.bulk-action-left')
            : this.bulkActionBar.querySelector('.bulk-action-right');
            
        if (targetContainer) {
            targetContainer.appendChild(button);
        }
    }
    
    /**
     * Destroy the bulk action bar and clean up
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.bulkActionBar = null;
        this.isVisible = false;
        this.isLoading = false;
    }
}

// Export for use in other modules
window.BulkActionBar = BulkActionBar;
