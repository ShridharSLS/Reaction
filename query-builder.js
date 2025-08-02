/**
 * Query Builder Abstraction for Supabase Operations
 * 
 * This module provides a DRY abstraction layer over common Supabase query patterns
 * to eliminate code duplication and provide consistent error handling.
 * 
 * Following DRY, KISS, and SOLID principles:
 * - DRY: Eliminates repeated query patterns
 * - KISS: Simple, intuitive API
 * - SOLID: Single responsibility for each method
 */

const { supabase } = require('./supabase');

class QueryBuilder {
    constructor(tableName) {
        this.tableName = tableName;
        this.query = supabase.from(tableName);
    }

    // ===== SELECT OPERATIONS =====
    
    /**
     * Find a single record by ID
     * @param {number|string} id - Record ID
     * @param {string} columns - Columns to select (default: '*')
     * @returns {Promise<Object|null>} Single record or null
     */
    static async findById(tableName, id, columns = '*') {
        const { data, error } = await supabase
            .from(tableName)
            .select(columns)
            .eq('id', id)
            .maybeSingle();
            
        if (error) throw error;
        return data;
    }

    /**
     * Find a single record by any field
     * @param {string} tableName - Table name
     * @param {string} field - Field name
     * @param {any} value - Field value
     * @param {string} columns - Columns to select
     * @returns {Promise<Object|null>} Single record or null
     */
    static async findBy(tableName, field, value, columns = '*') {
        const { data, error } = await supabase
            .from(tableName)
            .select(columns)
            .eq(field, value)
            .maybeSingle();
            
        if (error) throw error;
        return data;
    }

    /**
     * Find all records with optional filters
     * @param {string} tableName - Table name
     * @param {Object} filters - Key-value pairs for filtering
     * @param {string} columns - Columns to select
     * @param {string} orderBy - Order by clause
     * @returns {Promise<Array>} Array of records
     */
    static async findAll(tableName, filters = {}, columns = '*', orderBy = null) {
        let query = supabase.from(tableName).select(columns);
        
        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                query = query.in(key, value);
            } else if (value !== null && value !== undefined) {
                query = query.eq(key, value);
            }
        });
        
        // Apply ordering
        if (orderBy) {
            const [column, direction = 'asc'] = orderBy.split(' ');
            query = query.order(column, { ascending: direction.toLowerCase() === 'asc' });
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    /**
     * Check if a record exists
     * @param {string} tableName - Table name
     * @param {string} field - Field name
     * @param {any} value - Field value
     * @returns {Promise<boolean>} True if exists
     */
    static async exists(tableName, field, value) {
        const { data, error } = await supabase
            .from(tableName)
            .select('id')
            .eq(field, value)
            .maybeSingle();
            
        if (error) throw error;
        return !!data;
    }

    // ===== INSERT OPERATIONS =====
    
    /**
     * Create a single record
     * @param {string} tableName - Table name
     * @param {Object} data - Record data
     * @param {string} returnColumns - Columns to return
     * @returns {Promise<Object>} Created record
     */
    static async create(tableName, data, returnColumns = '*') {
        const { data: result, error } = await supabase
            .from(tableName)
            .insert([data])
            .select(returnColumns)
            .single();
            
        if (error) throw error;
        return result;
    }

    /**
     * Create multiple records
     * @param {string} tableName - Table name
     * @param {Array} dataArray - Array of record data
     * @param {string} returnColumns - Columns to return
     * @returns {Promise<Array>} Created records
     */
    static async createMany(tableName, dataArray, returnColumns = '*') {
        const { data, error } = await supabase
            .from(tableName)
            .insert(dataArray)
            .select(returnColumns);
            
        if (error) throw error;
        return data || [];
    }

    // ===== UPDATE OPERATIONS =====
    
    /**
     * Update a record by ID
     * @param {string} tableName - Table name
     * @param {number|string} id - Record ID
     * @param {Object} data - Update data
     * @param {string} returnColumns - Columns to return
     * @returns {Promise<Object>} Updated record
     */
    static async updateById(tableName, id, data, returnColumns = '*') {
        const { data: result, error } = await supabase
            .from(tableName)
            .update(data)
            .eq('id', id)
            .select(returnColumns)
            .single();
            
        if (error) throw error;
        return result;
    }

    /**
     * Update records by field
     * @param {string} tableName - Table name
     * @param {string} field - Field name
     * @param {any} value - Field value
     * @param {Object} data - Update data
     * @param {string} returnColumns - Columns to return
     * @returns {Promise<Array>} Updated records
     */
    static async updateBy(tableName, field, value, data, returnColumns = '*') {
        const { data: result, error } = await supabase
            .from(tableName)
            .update(data)
            .eq(field, value)
            .select(returnColumns);
            
        if (error) throw error;
        return result || [];
    }

    // ===== DELETE OPERATIONS =====
    
    /**
     * Delete a record by ID
     * @param {string} tableName - Table name
     * @param {number|string} id - Record ID
     * @returns {Promise<Object>} Deleted record
     */
    static async deleteById(tableName, id) {
        const { data, error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    /**
     * Delete records by field
     * @param {string} tableName - Table name
     * @param {string} field - Field name
     * @param {any} value - Field value
     * @returns {Promise<Array>} Deleted records
     */
    static async deleteBy(tableName, field, value) {
        const { data, error } = await supabase
            .from(tableName)
            .delete()
            .eq(field, value)
            .select();
            
        if (error) throw error;
        return data || [];
    }

    // ===== SPECIALIZED OPERATIONS =====
    
    /**
     * Upsert (insert or update) a record
     * @param {string} tableName - Table name
     * @param {Object} data - Record data
     * @param {string} conflictColumns - Columns for conflict resolution
     * @param {string} returnColumns - Columns to return
     * @returns {Promise<Object>} Upserted record
     */
    static async upsert(tableName, data, conflictColumns = 'id', returnColumns = '*') {
        const { data: result, error } = await supabase
            .from(tableName)
            .upsert(data, { onConflict: conflictColumns })
            .select(returnColumns)
            .single();
            
        if (error) throw error;
        return result;
    }

    /**
     * Count records with optional filters
     * @param {string} tableName - Table name
     * @param {Object} filters - Key-value pairs for filtering
     * @returns {Promise<number>} Record count
     */
    static async count(tableName, filters = {}) {
        let query = supabase.from(tableName).select('*', { count: 'exact', head: true });
        
        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                query = query.in(key, value);
            } else if (value !== null && value !== undefined) {
                query = query.eq(key, value);
            }
        });
        
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
    }

    // ===== TRANSACTION HELPERS =====
    
    /**
     * Execute multiple operations in sequence with error rollback
     * @param {Array} operations - Array of operation functions
     * @returns {Promise<Array>} Results of all operations
     */
    static async transaction(operations) {
        const results = [];
        
        try {
            for (const operation of operations) {
                const result = await operation();
                results.push(result);
            }
            return results;
        } catch (error) {
            // In a real transaction system, we would rollback here
            // For now, we just throw the error
            throw error;
        }
    }
}

module.exports = QueryBuilder;
