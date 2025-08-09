// ===== BULK IMPORT UI COMPONENT =====
// Reusable UI component for bulk import functionality
// Handles rendering and user interactions for both full and submit page imports

class BulkImportUI {
    constructor(containerId, configType, options = {}) {
        this.containerId = containerId;
        this.config = BULK_IMPORT_CONFIGS[configType];
        this.handler = new BulkImportHandler(this.config);
        this.options = {
            apiService: options.apiService || window.ApiService,
            people: options.people || [],
            onSuccess: options.onSuccess || (() => {}),
            onError: options.onError || (() => {}),
            showInstructions: options.showInstructions !== false
        };
        
        this.isSubmitting = false;
        this.render();
        this.attachEventListeners();
    }
    
    // Render the complete bulk import UI
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container with ID '${this.containerId}' not found`);
            return;
        }
        
        container.innerHTML = `
            <div class="bulk-import-section">
                ${this.renderInstructions()}
                ${this.renderForm()}
                ${this.renderPreview()}
                ${this.renderResults()}
            </div>
        `;
    }
    
    // Render instructions section
    renderInstructions() {
        if (!this.options.showInstructions) return '';
        
        return `
            <div class="bulk-import-instructions">
                <h3>${this.config.instructions.title}</h3>
                ${this.config.instructions.description}
            </div>
        `;
    }
    
    // Render form section
    renderForm() {
        return `
            <div class="bulk-import-form">
                <div class="form-group">
                    <label for="${this.containerId}-bulk-data">Paste Data from Google Sheets:</label>
                    <textarea
                        id="${this.containerId}-bulk-data"
                        class="bulk-data-textarea"
                        placeholder="${this.config.instructions.placeholder}"
                        rows="10"
                    ></textarea>
                </div>
                
                <div class="bulk-actions">
                    <button type="button" class="btn btn-secondary bulk-preview-btn">
                        ${this.config.ui.previewButtonText}
                    </button>
                    <button type="button" class="btn btn-primary bulk-submit-btn" disabled>
                        ${this.config.ui.submitButtonText}
                    </button>
                </div>
            </div>
        `;
    }
    
    // Render preview section
    renderPreview() {
        return `
            <div id="${this.containerId}-bulk-preview" class="bulk-preview" style="display: none">
                <h3>Preview of Parsed Data:</h3>
                <div id="${this.containerId}-bulk-preview-table" class="bulk-preview-table"></div>
                <div id="${this.containerId}-bulk-validation-errors" class="bulk-validation-errors"></div>
            </div>
        `;
    }
    
    // Render results section
    renderResults() {
        return `
            <div id="${this.containerId}-bulk-results" class="bulk-results" style="display: none">
                <h3>Import Results:</h3>
                <div id="${this.containerId}-bulk-results-content"></div>
            </div>
        `;
    }
    
    // Attach event listeners
    attachEventListeners() {
        const container = document.getElementById(this.containerId);
        
        // Preview button
        const previewBtn = container.querySelector('.bulk-preview-btn');
        previewBtn.addEventListener('click', () => this.previewData());
        
        // Submit button
        const submitBtn = container.querySelector('.bulk-submit-btn');
        submitBtn.addEventListener('click', () => this.submitData());
    }
    
    // Preview bulk data
    previewData() {
        const textarea = document.getElementById(`${this.containerId}-bulk-data`);
        const previewDiv = document.getElementById(`${this.containerId}-bulk-preview`);
        const tableDiv = document.getElementById(`${this.containerId}-bulk-preview-table`);
        const errorsDiv = document.getElementById(`${this.containerId}-bulk-validation-errors`);
        const submitBtn = document.querySelector(`#${this.containerId} .bulk-submit-btn`);
        
        const bulkData = textarea.value.trim();
        if (!bulkData) {
            alert('Please paste some data first');
            return;
        }
        
        // Parse and validate data
        const errors = this.handler.parseData(bulkData);
        
        // Display preview table
        if (this.handler.getCount() > 0) {
            tableDiv.innerHTML = this.handler.generatePreviewTable();
        }
        
        // Display errors or success message
        if (errors.length > 0) {
            errorsDiv.innerHTML = '<h4>Validation Errors:</h4>' + 
                errors.map(error => `<div class="error-item">${this.escapeHtml(error)}</div>`).join('');
            submitBtn.disabled = true;
        } else {
            errorsDiv.innerHTML = '<div style="color: #28a745; font-weight: 600;">✅ All data looks good!</div>';
            submitBtn.disabled = false;
        }
        
        previewDiv.style.display = 'block';
    }
    
    // Submit bulk data
    async submitData() {
        if (this.handler.getCount() === 0) {
            alert('Please preview the data first');
            return;
        }
        
        if (this.isSubmitting) {
            return; // Prevent double submission
        }
        
        const submitBtn = document.querySelector(`#${this.containerId} .bulk-submit-btn`);
        const resultsDiv = document.getElementById(`${this.containerId}-bulk-results`);
        const resultsContent = document.getElementById(`${this.containerId}-bulk-results-content`);
        
        this.isSubmitting = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        
        try {
            // Submit data using the handler
            const result = await this.handler.submitData(
                this.options.apiService,
                this.options.people,
                {
                    onProgress: (current, total) => {
                        submitBtn.textContent = `Submitting... (${current}/${total})`;
                    }
                }
            );
            
            // Display results
            this.displayResults(result, resultsContent);
            resultsDiv.style.display = 'block';
            
            // Reset form if all successful
            if (result.errorCount === 0) {
                this.resetForm();
                
                // Call success callback
                this.options.onSuccess(result);
            }
            
        } catch (error) {
            console.error('Bulk import error:', error);
            resultsContent.innerHTML = `
                <div class="error-item">
                    <strong>Import Failed:</strong> ${this.escapeHtml(error.message)}
                </div>
            `;
            resultsDiv.style.display = 'block';
            
            // Call error callback
            this.options.onError(error);
        } finally {
            this.isSubmitting = false;
            submitBtn.disabled = false;
            submitBtn.textContent = this.config.ui.submitButtonText;
        }
    }
    
    // Display import results
    displayResults(result, resultsContent) {
        let resultsHTML = `
            <div style="margin-bottom: 15px;">
                <strong>${this.config.ui.successMessage}:</strong> 
                ${result.successCount} successful, ${result.skippedCount} skipped, ${result.errorCount} errors
            </div>
        `;
        
        result.results.forEach(item => {
            let className = 'error-item'; // default
            if (item.status === 'success') {
                className = 'success-item';
            } else if (item.status === 'skipped') {
                className = 'skipped-item';
            }
            resultsHTML += `<div class="${className}">Row ${item.row}: ${this.escapeHtml(item.message)}</div>`;
        });
        
        resultsContent.innerHTML = resultsHTML;
    }
    
    // Reset form after successful submission
    resetForm() {
        const textarea = document.getElementById(`${this.containerId}-bulk-data`);
        const previewDiv = document.getElementById(`${this.containerId}-bulk-preview`);
        
        textarea.value = '';
        previewDiv.style.display = 'none';
        this.handler.clear();
    }
    
    // Update people array (for dynamic people loading)
    updatePeople(people) {
        this.options.people = people;
    }
    
    // Get current data count
    getDataCount() {
        return this.handler.getCount();
    }
    
    // Check if currently submitting
    isCurrentlySubmitting() {
        return this.isSubmitting;
    }
    
    // Utility function
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BulkImportUI;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.BulkImportUI = BulkImportUI;
}
