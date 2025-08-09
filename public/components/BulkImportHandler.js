// ===== BULK IMPORT HANDLER - REUSABLE COMPONENT =====
// Handles bulk import functionality with configurable column definitions
// Supports both full bulk import (with relevance) and submit page import (without relevance)

class BulkImportHandler {
    constructor(config) {
        this.config = config;
        this.parsedData = [];
    }

    // Parse tab-separated data based on configuration
    parseData(rawData) {
        const lines = rawData.split('\n').filter(line => line.trim());
        this.parsedData = [];
        const errors = [];
        
        lines.forEach((line, index) => {
            const columns = line.split('\t');
            const rowNum = index + 1;
            
            // Dynamic column count validation based on config
            if (columns.length < this.config.minColumns) {
                errors.push(`Row ${rowNum}: Expected ${this.config.minColumns}-${this.config.maxColumns} columns (${this.config.columnNames}), found ${columns.length}`);
                return;
            }
            
            // Parse columns dynamically based on configuration
            const rowData = { rowNum };
            
            // Standard columns (always present)
            rowData.name = columns[0]?.trim() || '';
            rowData.link = columns[1]?.trim() || '';
            rowData.type = columns[2]?.trim() || '';
            rowData.likes = columns[3]?.trim() || '';
            rowData.pitch = columns[4]?.trim() || '';
            
            // Relevance column handling based on config
            if (this.config.hasRelevance) {
                rowData.relevance = columns[5]?.trim() || '';
            } else {
                rowData.relevance = null; // Always null for submit page
            }
            
            // Validation
            this.validateRow(rowData, rowNum, errors);
            
            // Process data types
            rowData.likes = rowData.likes ? parseInt(rowData.likes) : 0;
            if (this.config.hasRelevance && rowData.relevance !== null && rowData.relevance !== '') {
                rowData.relevance = parseInt(rowData.relevance);
            } else {
                rowData.relevance = null;
            }
            
            this.parsedData.push(rowData);
        });
        
        return errors;
    }
    
    // Validate individual row based on configuration
    validateRow(rowData, rowNum, errors) {
        // Name validation
        if (!rowData.name) {
            errors.push(`Row ${rowNum}: Name is required`);
        }
        
        // Link validation
        if (!rowData.link) {
            errors.push(`Row ${rowNum}: Link is required`);
        } else {
            try {
                new URL(rowData.link);
            } catch {
                errors.push(`Row ${rowNum}: Invalid URL format`);
            }
        }
        
        // Type validation
        if (!rowData.type || !['Trending', 'General'].includes(rowData.type)) {
            errors.push(`Row ${rowNum}: Type must be 'Trending' or 'General'`);
        }
        
        // Likes validation
        if (rowData.likes && isNaN(parseInt(rowData.likes))) {
            errors.push(`Row ${rowNum}: Likes count must be a number`);
        }
        
        // Relevance validation (only if config includes relevance)
        if (this.config.hasRelevance && rowData.relevance && rowData.relevance !== '') {
            if (isNaN(parseInt(rowData.relevance)) || parseInt(rowData.relevance) < 0 || parseInt(rowData.relevance) > 3) {
                errors.push(`Row ${rowNum}: Relevance must be empty or a number between 0-3`);
            }
        }
    }
    
    // Generate preview table HTML based on configuration
    generatePreviewTable() {
        if (this.parsedData.length === 0) {
            return '<p>No data to preview</p>';
        }
        
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Row</th>
                        <th>Name</th>
                        <th>Link</th>
                        <th>Type</th>
                        <th>Likes</th>
                        <th>Pitch</th>`;
        
        // Add relevance column header only if config includes it
        if (this.config.hasRelevance) {
            tableHTML += '<th>Relevance</th>';
        }
        
        tableHTML += '<th>Destination</th></tr></thead><tbody>';
        
        // Generate table rows
        this.parsedData.forEach(row => {
            const relevanceDisplay = row.relevance !== null ? row.relevance : '-';
            const destination = row.relevance !== null ? '🟡 Pending' : '🎯 Relevance';
            const pitchDisplay = row.pitch ? (row.pitch.length > 30 ? row.pitch.substring(0, 30) + '...' : row.pitch) : '-';
            
            tableHTML += `
                <tr>
                    <td>${row.rowNum}</td>
                    <td>${this.escapeHtml(row.name)}</td>
                    <td><a href="${this.escapeHtml(row.link)}" target="_blank">${this.truncateUrl(row.link, 40)}</a></td>
                    <td>${this.escapeHtml(row.type)}</td>
                    <td>${row.likes}</td>
                    <td title="${this.escapeHtml(row.pitch || '')}">${this.escapeHtml(pitchDisplay)}</td>`;
            
            // Add relevance column data only if config includes it
            if (this.config.hasRelevance) {
                tableHTML += `<td>${relevanceDisplay}</td>`;
            }
            
            tableHTML += `<td>${destination}</td></tr>`;
        });
        
        return tableHTML + '</tbody></table>';
    }
    
    // Submit bulk data using provided API service and people array
    async submitData(apiService, people, callbacks = {}) {
        if (this.parsedData.length === 0) {
            throw new Error('No data to submit. Please preview the data first.');
        }
        
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        
        // Callback for progress updates
        if (callbacks.onProgress) {
            callbacks.onProgress(0, this.parsedData.length);
        }
        
        // Submit each video
        for (let i = 0; i < this.parsedData.length; i++) {
            const row = this.parsedData[i];
            
            try {
                // Find person by name or create if doesn't exist
                let person = people.find(p => p.name.toLowerCase() === row.name.toLowerCase());
                
                if (!person) {
                    // Create new person automatically
                    try {
                        const newPerson = await apiService.createPerson({ name: row.name });
                        person = { id: newPerson.id, name: row.name };
                        people.push(person); // Add to local people array for subsequent rows
                    } catch (createError) {
                        results.push({
                            row: row.rowNum,
                            status: 'error',
                            message: `Failed to create person '${row.name}': ${createError.message}`
                        });
                        errorCount++;
                        continue;
                    }
                }
                
                // Prepare video data
                const videoData = {
                    added_by: person.id,
                    link: row.link,
                    type: row.type,
                    likes_count: row.likes,
                    relevance_rating: row.relevance !== null ? row.relevance : -1,
                    pitch: row.pitch || null
                };
                
                // Submit video
                await apiService.createVideo(videoData);
                results.push({
                    row: row.rowNum,
                    status: 'success',
                    message: `Successfully added video for ${row.name}`
                });
                successCount++;
                
            } catch (error) {
                // Handle duplicate URLs as "skipped" rather than "error"
                if (error.status === 409 && error.message && error.message.includes('already exists')) {
                    results.push({
                        row: row.rowNum,
                        status: 'skipped',
                        message: `Skipped: URL already exists in system`
                    });
                    skippedCount++;
                } else {
                    results.push({
                        row: row.rowNum,
                        status: 'error',
                        message: error.message || 'Failed to add video'
                    });
                    errorCount++;
                }
            }
            
            // Progress callback
            if (callbacks.onProgress) {
                callbacks.onProgress(i + 1, this.parsedData.length);
            }
        }
        
        return {
            results,
            successCount,
            errorCount,
            skippedCount,
            totalCount: this.parsedData.length
        };
    }
    
    // Utility functions
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    truncateUrl(url, maxLength = 50) {
        if (!url || url.length <= maxLength) return url || '';
        return url.substring(0, maxLength) + '...';
    }
    
    // Clear parsed data
    clear() {
        this.parsedData = [];
    }
    
    // Get parsed data
    getData() {
        return this.parsedData;
    }
    
    // Get data count
    getCount() {
        return this.parsedData.length;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BulkImportHandler;
}
