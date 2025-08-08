const { supabase } = require('./supabase');

/**
 * StatusUpdateService - Centralized service for handling video status updates
 * Follows SOLID principles:
 * - Single Responsibility: Handles only status updates and timestamp management
 * - Open/Closed: Easy to extend for new hosts without modifying existing code
 * - Dependency Inversion: Uses dependency injection for database operations
 */
class StatusUpdateService {
  /**
   * Update video status for a specific host with automatic timestamp tracking
   * @param {number} videoId - The video ID to update
   * @param {string|number} hostId - The host ID (1 for Shridhar, 2 for Vidushi)
   * @param {string} newStatus - The new status value
   * @param {string|null} note - Optional note to update
   * @param {string|null} videoIdText - Optional video ID text to update
   * @param {Function} getHostColumns - Function to get host column mappings
   * @returns {Promise<Object>} Update result with timestamp information
   */
  static async updateVideoStatus(videoId, hostId, newStatus, note = null, videoIdText = null, getHostColumns = null) {
    try {
      // Get dynamic column mappings for the host
      // Use actual schema if getHostColumns is not provided
      const columns = getHostColumns ? await getHostColumns(hostId) : this.getActualHostColumns(hostId);
      
      // Build update data dynamically
      const updateData = {};
      updateData[columns.statusColumn] = newStatus;
      
      // Add timestamp column - this will be automatically set by database trigger
      // but we can also set it explicitly for consistency
      const timestampColumn = this.getTimestampColumn(hostId);
      updateData[timestampColumn] = new Date().toISOString();
      
      // Add optional fields if provided
      if (note !== null && note !== undefined) {
        updateData[columns.noteColumn] = note;
      }
      
      if (videoIdText !== null && videoIdText !== undefined) {
        updateData[columns.videoIdColumn] = videoIdText;
      }
      
      console.log(`[StatusUpdateService] Updating video ${videoId} for host ${hostId}:`, updateData);
      
      // Perform the database update
      const { data, error } = await supabase
        .from('videos')
        .update(updateData)
        .eq('id', videoId)
        .select(`id, ${columns.statusColumn}, ${timestampColumn}`)
        .single();
      
      if (error) {
        throw new Error(`Failed to update video status: ${error.message}`);
      }
      
      return {
        success: true,
        videoId: videoId,
        hostId: hostId,
        status: newStatus,
        timestamp: updateData[timestampColumn],
        columns: columns,
        data: data
      };
      
    } catch (error) {
      console.error(`[StatusUpdateService] Error updating video ${videoId} for host ${hostId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get the timestamp column name for a specific host
   * @param {string|number} hostId - The host ID
   * @returns {string} The timestamp column name
   */
  static getTimestampColumn(hostId) {
    const hostIdNum = parseInt(hostId);
    return `status_${hostIdNum}_updated_at`;
  }
  
  /**
   * Get the actual database column names for a specific host
   * @param {string|number} hostId - The host ID
   * @returns {Object} Column mappings for the host
   */
  static getActualHostColumns(hostId) {
    const hostIdNum = parseInt(hostId);
    return {
      statusColumn: `status_${hostIdNum}`,
      noteColumn: hostIdNum === 1 ? 'note' : `note_${hostIdNum}`,
      videoIdColumn: hostIdNum === 1 ? 'video_id_text' : `video_id_text_${hostIdNum}`
    };
  }
  
  /**
   * Get status update history for a video (useful for audit trails)
   * @param {number} videoId - The video ID
   * @returns {Promise<Object>} Status history with timestamps
   */
  static async getStatusHistory(videoId) {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select(`
          id,
          status_1,
          status_1_updated_at,
          status_2,
          status_2_updated_at,
          created_at
        `)
        .eq('id', videoId)
        .single();
      
      if (error) {
        throw new Error(`Failed to get status history: ${error.message}`);
      }
      
      return {
        videoId: videoId,
        hosts: {
          host1: {
            status: data.status_1,
            updatedAt: data.status_1_updated_at,
            lastChanged: this.formatTimestamp(data.status_1_updated_at)
          },
          host2: {
            status: data.status_2,
            updatedAt: data.status_2_updated_at,
            lastChanged: this.formatTimestamp(data.status_2_updated_at)
          }
        },
        createdAt: data.created_at
      };
      
    } catch (error) {
      console.error(`[StatusUpdateService] Error getting status history for video ${videoId}:`, error);
      throw error;
    }
  }
  
  /**
   * Format timestamp for display
   * @param {string} timestamp - ISO timestamp string
   * @returns {string} Formatted timestamp
   */
  static formatTimestamp(timestamp) {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
  
  /**
   * Bulk update status for multiple videos (useful for batch operations)
   * @param {Array} updates - Array of {videoId, hostId, status, note?, videoIdText?}
   * @param {Function} getHostColumns - Function to get host column mappings
   * @returns {Promise<Array>} Array of update results
   */
  static async bulkUpdateStatus(updates, getHostColumns) {
    const results = [];
    
    for (const update of updates) {
      try {
        const result = await this.updateVideoStatus(
          update.videoId,
          update.hostId,
          update.status,
          update.note,
          update.videoIdText,
          getHostColumns
        );
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          videoId: update.videoId,
          hostId: update.hostId,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = StatusUpdateService;
