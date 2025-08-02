// Global state
let currentTab = 'pending';
let people = [];
let tags = [];
let confirmationCallback = null;
let videoIdCallback = null;
let tagSelectionCallback = null;
let currentVideoId = null;

// Host Configuration System (Phase 1: Foundation)
// ===== HOST CONFIGURATION SYSTEM =====
// Multi-host support with dynamic column mapping
// Phase 4.2: Dynamic host configuration loaded from database

// Global host configuration - will be populated from database
let HOST_CONFIG = {};

// Load host configuration from database
async function loadHostConfiguration() {
    try {
        console.log('[Phase 4.2] Loading host configuration from database...');
        
        const hosts = await ApiService.getHosts();
        console.log('[Phase 4.2] Loaded hosts from database:', hosts);
        
        // Transform database format to frontend HOST_CONFIG format
        HOST_CONFIG = {};
        hosts.forEach(host => {
            HOST_CONFIG[host.host_id] = {
                id: host.host_id,
                name: host.name,
                prefix: host.prefix,
                statusCol: host.status_column,
                noteCol: host.note_column,
                videoIdCol: host.video_id_column,
                apiPath: host.api_path,
                countPrefix: host.count_prefix
            };
        });
        
        console.log('[Phase 4.2] HOST_CONFIG populated:', HOST_CONFIG);
        return true;
    } catch (error) {
        console.error('[Phase 4.2] Failed to load host configuration:', error);
        
        // No hardcoded fallback - system must be fully dynamic
        console.error('[ERROR] Failed to load host configuration from API. System requires dynamic host management.');
        console.error('Please ensure the /api/hosts endpoint is working and hosts are properly configured in the database.');
        
        // Initialize empty config to prevent errors
        HOST_CONFIG = {};
        
        // Show user-friendly error
        showNotification('Failed to load host configuration. Please refresh the page or contact administrator.', 'error');
        return false;
    }
}

// Helper function to get host configuration
function getHostConfig(hostId) {
    return HOST_CONFIG[hostId] || null;
}

// Helper function to detect host from tab/status string
function getHostFromStatus(status) {
    // Parse host ID from status string (e.g., 'host11-pending' -> 11)
    const hostMatch = status.match(/^host(\d+)-/);
    if (hostMatch) {
        return parseInt(hostMatch[1]);
    }
    return 1; // Default to Shridhar (Host 1)
}

// ===== HOST UTILITIES MODULE =====
// Consolidated host helper functions following DRY, KISS, and SOLID principles
const HostUtils = {
    // Get host configuration (Single source of truth)
    getConfig(hostId) {
        return HOST_CONFIG[hostId] || null;
    },
    
    // Get video column value for any host (DRY implementation)
    getVideoColumn(video, hostId, columnType) {
        const config = this.getConfig(hostId);
        if (!config) return null;
        
        const columnMap = {
            'status': config.statusCol,
            'note': config.noteCol,
            'videoId': config.videoIdCol
        };
        
        const column = columnMap[columnType];
        return column ? video[column] : null;
    },
    
    // Get API endpoint for host operations (Unified endpoint pattern)
    getApiEndpoint(hostId, videoId, action = 'status') {
        const config = this.getConfig(hostId);
        if (!config) return null;
        
        // All hosts use the same unified API pattern
        return `/api/videos/${videoId}/host/${hostId}/status`;
    },
    
    // Get count key for any host and status (Consistent naming)
    getCountKey(hostId, status) {
        const config = this.getConfig(hostId);
        if (!config) return null;
        
        return config.countPrefix ? `${config.countPrefix}${status}` : status;
    },
    
    // Get tab ID for any host and status (Dynamic tab generation)
    getTabId(hostId, status) {
        const config = this.getConfig(hostId);
        if (!config) return null;
        
        return config.prefix ? `${config.prefix}${status}` : status;
    },
    
    // Parse host ID from tab ID (Utility for reverse lookup)
    parseHostFromTab(tabId) {
        const hostMatch = tabId.match(/^host(\d+)-/);
        return hostMatch ? parseInt(hostMatch[1]) : 1; // Default to Host 1
    },
    
    // Validate host exists and is active (Error prevention)
    isValidHost(hostId) {
        const config = this.getConfig(hostId);
        return config !== null;
    }
};

// Legacy function wrappers for backward compatibility (will be removed in future steps)
function getVideoColumn(video, hostId, columnType) {
    return HostUtils.getVideoColumn(video, hostId, columnType);
}

function getHostApiEndpoint(hostId, videoId, action) {
    return HostUtils.getApiEndpoint(hostId, videoId, action);
}

function getHostStatusEndpoint(videoId, hostId) {
    return HostUtils.getApiEndpoint(hostId, videoId, 'status');
}

function getCountKey(hostId, status) {
    return HostUtils.getCountKey(hostId, status);
}

function getTabId(hostId, status) {
    return HostUtils.getTabId(hostId, status);
}

function getHostFromTab(tabId) {
    return HostUtils.parseHostFromTab(tabId);
}

// ===== PHASE 3.1: DYNAMIC BUTTON GENERATION SYSTEM =====
// Template-based button generation that works for any host and status

// Button templates define what buttons appear for each status
// NOTE: Delete buttons are only available in Relevance and Trash views
// Hosts can only reject videos, not delete them
const BUTTON_TEMPLATES = {
    pending: [
        { type: 'accept', label: 'Accept', class: 'btn-success' },
        { type: 'assign', label: 'ID given', class: 'btn-primary' },
        { type: 'reject', label: 'Reject', class: 'btn-reject' }
        // Delete removed: hosts cannot delete videos
    ],
    accepted: [
        { type: 'copy', label: '📋', class: 'copy-btn', title: 'Copy link and note for Google Sheets' },
        { type: 'assign', label: 'ID given', class: 'btn-primary' },
        { type: 'reject', label: 'Reject', class: 'btn-reject' },
        { type: 'pending', label: 'Pending', class: 'btn-warning' }
        // Delete removed: hosts cannot delete videos
    ],
    rejected: [
        { type: 'accept', label: 'Accept', class: 'btn-success' },
        { type: 'pending', label: 'Pending', class: 'btn-warning' }
        // Delete removed: hosts cannot delete videos
    ],
    assigned: [
        { type: 'copy', label: '📋', class: 'copy-btn', title: 'Copy link and note for Google Sheets' }
        // Delete removed: hosts cannot delete videos
    ],
    relevance: [
        { type: 'delete', label: 'Delete', class: 'btn-danger' }
        // Delete kept: admins can delete from relevance section
    ],
    trash: [
        { type: 'delete', label: 'Delete', class: 'btn-danger' }
        // Delete kept: admins can delete from trash section
    ]
};

// Generate a single button based on template and host configuration
function generateButton(buttonTemplate, hostId, videoId, video) {
    const { type, label, class: btnClass, title } = buttonTemplate;
    
    let onclick = '';
    
    switch (type) {
        case 'accept':
        case 'reject':
            // Use same approach as note icon - get note from video object and call showNoteModal directly
            const config = getHostConfig(hostId);
            const currentNote = config && video[config.noteCol] ? video[config.noteCol] : '';
            const escapedNote = currentNote ? escapeHtml(currentNote).replace(/'/g, "\\'") : '';
            onclick = `showNoteModal(${videoId}, '${type}', '${escapedNote}')`;
            break;
        case 'assign':
        case 'pending':
            onclick = `hostAction(${hostId}, ${videoId}, '${type}')`;
            break;
            
        case 'delete':
            onclick = `deleteVideo(${videoId})`;
            break;
            
        case 'copy':
            // Get the correct note column for this host
            const noteCol = getHostConfig(hostId)?.noteCol || 'note';
            const note = video[noteCol] || '';
            // Avoid template string escaping issues by using string concatenation
            onclick = 'copyLinkAndNote("' + video.link.replace(/"/g, '\\"') + '", "' + (note || '').replace(/"/g, '\\"') + '")';
            break;
            
        default:
            return ''; // Unknown button type
    }
    
    // Build the button HTML
    const titleAttr = title ? ` title="${title}"` : '';
    return `<button class="btn ${btnClass}" onclick="${onclick}"${titleAttr}>${label}</button>`;
}

// Generate all action buttons for a video based on host and status
function generateVideoActions(video, hostId, status) {
    const template = BUTTON_TEMPLATES[status];
    if (!template) {
        console.warn(`No button template found for status: ${status}`);
        return '';
    }
    
    const buttons = template.map(buttonTemplate => 
        generateButton(buttonTemplate, hostId, video.id, video)
    ).filter(button => button !== ''); // Remove empty buttons
    
    return buttons.join('\n                ');
}

// Unified function to get video actions for any host (replaces getVideoActions and getHost2VideoActions)
function getUnifiedVideoActions(video, status) {
    // Detect host from status string
    const hostId = getHostFromStatus(status);
    
    // Extract the actual status (remove host prefix if present)
    const actualStatus = getBaseStatus(status);
    
    // Generate buttons using the template system
    return generateVideoActions(video, hostId, actualStatus);
}

// ===== PHASE 3.3 MINIMAL: HOST-AGNOSTIC DATA ACCESS =====
// Minimal helper functions to eliminate hardcoded host logic in video cards

// Get base status from prefixed status (e.g., 'host2-pending' -> 'pending')
function getBaseStatus(status) {
    // Remove host prefixes to get base status
    return status.replace(/^host\d+-/, '');
}

// Get host-specific video ID value dynamically
function getHostVideoIdValue(video, status) {
    const hostId = getHostFromStatus(status);
    const config = getHostConfig(hostId);
    if (!config) return null;
    
    // Use the correct column property from HOST_CONFIG
    const videoIdColumn = config.videoIdCol;
    return video[videoIdColumn] || null;
}

// Get host-specific note value dynamically
function getHostNoteValue(video, status) {
    const hostId = getHostFromStatus(status);
    const config = getHostConfig(hostId);
    if (!config) return null;
    
    // Use the correct column property from HOST_CONFIG
    const noteColumn = config.noteCol;
    return video[noteColumn] || null;
}

// ===== PHASE 3.2: DYNAMIC NAVIGATION GENERATION SYSTEM =====
// Template-based navigation generation that works for any number of hosts

// Navigation templates define the structure of dropdowns and buttons
const NAVIGATION_TEMPLATES = {
    // Static navigation items (not host-specific)
    static: [
        {
            type: 'dropdown',
            id: 'tasks',
            label: '📋 Tasks',
            items: [
                { id: 'add-topic', label: '➕ Add Topic' },
                { id: 'bulk-import', label: '📋 Bulk Import' },
                { id: 'manage-people', label: '👥 Manage People' },
                { id: 'manage-tags', label: '🏷️ Manage Tags' },
                { id: 'manage-hosts', label: '🖥️ Manage Hosts' },
                { id: 'manage-admins', label: '🔐 Manage Admins' }
            ]
        },
        {
            type: 'button',
            id: 'relevance',
            label: '🎯 Relevance',
            showCount: true
        },
        {
            type: 'button',
            id: 'trash',
            label: '🗑️ Trash',
            showCount: true
        }
    ],
    // Host-specific navigation template
    host: {
        type: 'dropdown',
        items: [
            { id: 'pending', label: '🟡 Pending', showCount: true },
            { id: 'accepted', label: '✅ Accepted', showCount: true },
            { id: 'rejected', label: '🟥 Rejected', showCount: true },
            { id: 'assigned', label: '🆔 ID given', showCount: true }
        ]
    },
    // Static navigation items that come after hosts
    staticAfter: [
        {
            type: 'button',
            id: 'all',
            label: '📈 All',
            showCount: true
        }
    ]
};

// Generate navigation HTML for all hosts dynamically
function generateNavigationHTML() {
    let navHTML = '';
    
    // Add static navigation items (before hosts)
    NAVIGATION_TEMPLATES.static.forEach(item => {
        navHTML += generateNavigationItem(item);
    });
    
    // Add host-specific navigation dropdowns
    Object.keys(HOST_CONFIG).forEach(hostId => {
        const config = HOST_CONFIG[hostId];
        navHTML += generateHostNavigation(parseInt(hostId), config);
    });
    
    // Add static navigation items (after hosts)
    NAVIGATION_TEMPLATES.staticAfter.forEach(item => {
        navHTML += generateNavigationItem(item);
    });
    
    return navHTML;
}

// Generate a single navigation item (dropdown or button)
function generateNavigationItem(item) {
    if (item.type === 'dropdown') {
        return generateDropdown(item.id, item.label, item.items);
    } else if (item.type === 'button') {
        return generateNavigationButton(item.id, item.label, item.showCount);
    }
    return '';
}

// Generate host-specific navigation dropdown
function generateHostNavigation(hostId, config) {
    const hostLabel = `👨‍💼 ${config.name}`;
    const hostItems = NAVIGATION_TEMPLATES.host.items.map(item => ({
        id: getTabId(hostId, item.id),
        label: item.label,
        showCount: item.showCount,
        countId: getButtonCountId(hostId, item.id)
    }));
    
    return generateDropdown(`host-${hostId}`, hostLabel, hostItems);
}

// Generate dropdown HTML
function generateDropdown(id, label, items) {
    const itemsHTML = items.map(item => {
        const countSpan = item.showCount ? 
            `<span class="btn-count" id="${item.countId || item.id + '-btn-count'}"></span>` : '';
        return `<button class="dropdown-item" data-tab="${item.id}">${item.label} ${countSpan}</button>`;
    }).join('\n                    ');
    
    return `
            <div class="dropdown">
                <button class="dropdown-btn">${label} ▼</button>
                <div class="dropdown-content">
                    ${itemsHTML}
                </div>
            </div>`;
}

// Generate navigation button HTML
function generateNavigationButton(id, label, showCount = false) {
    const countSpan = showCount ? `<span class="btn-count" id="${id}-btn-count"></span>` : '';
    return `<button class="tab-btn" data-tab="${id}">${label} ${countSpan}</button>`;
}

// Initialize dynamic navigation system
function initializeDynamicNavigation() {
    const navContainer = document.querySelector('.tab-nav');
    if (navContainer) {
        navContainer.innerHTML = generateNavigationHTML();
        console.log('[Dynamic Navigation] Navigation generated for', Object.keys(HOST_CONFIG).length, 'hosts');
    }
}

// Get the correct button count element ID for any host and status
function getButtonCountId(hostId, status) {
    const config = getHostConfig(hostId);
    if (!config) return null;
    
    // Use prefix for all hosts consistently
    if (config.prefix) {
        return `${config.prefix}${status}-btn-count`; // e.g., 'host2-pending-btn-count'
    } else {
        return `${status}-btn-count`; // For hosts with no prefix (like Host 1)
    }
}

// Get the correct view count element ID for any host and status
function getViewCountId(hostId, status) {
    const config = getHostConfig(hostId);
    if (!config) return null;
    
    // Use prefix for all hosts consistently
    if (config.prefix) {
        return `${config.prefix}${status}-count`; // e.g., 'host2-pending-count'
    } else {
        return `${status}-count`; // For hosts with no prefix (like Host 1)
    }
}

// Helper function for success notifications
function showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300); // Wait for fade-out animation
    }, 3000);
}

// Missing showNotification function - unified notification system
function showNotification(message, type = 'info') {
    // Use the existing showTemporaryMessage function for consistency
    showTemporaryMessage(message, type);
}

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    console.log('App initializing... currentTab:', currentTab);
    
    // Phase 4.2: Load host configuration from database first
    await loadHostConfiguration();
    
    // Initialize dynamic navigation system (Phase 3.2) - now uses dynamic HOST_CONFIG
    initializeDynamicNavigation();
    
    initializeTabs();
    loadPeople();
    loadTags();
    setupForms();
    setupModals();
    setupTagModal();
    
    // Force load pending videos immediately
    console.log('Loading initial videos for tab:', currentTab);
    loadVideos(currentTab).then(() => {
        console.log('Initial videos loaded successfully');
        // Also load relevance and trash counts
        updateRelevanceCount();
    }).catch(error => {
        console.error('Failed to load initial videos:', error);
    });
    
    // Update button counts with debugging
    setTimeout(() => {
        console.log('Updating button counts...');
        updateButtonCounts();
    }, 200);
});

// Tab Management
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    const dropdownBtns = document.querySelectorAll('.dropdown-btn');
    const dropdowns = document.querySelectorAll('.dropdown');
    
    // Handle regular tab buttons
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    // Handle dropdown items
    dropdownItems.forEach(item => {
        item.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
            // Close all dropdowns after selection
            dropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        });
    });
    
    // Handle dropdown toggles
    dropdownBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const parentDropdown = this.closest('.dropdown');
            
            // Close all other dropdowns
            dropdowns.forEach(dropdown => {
                if (dropdown !== parentDropdown) {
                    dropdown.classList.remove('active');
                }
            });
            
            // Toggle current dropdown
            parentDropdown.classList.toggle('active');
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    });
}

function switchTab(tabId) {
    // Update regular tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Update dropdown items
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Update dropdown button states
    const dropdownBtns = document.querySelectorAll('.dropdown-btn');
    const isTasksDropdownTab = ['add-topic', 'bulk-import', 'manage-people', 'manage-tags', 'manage-admins'].includes(tabId);
    const isClosedDropdownTab = ['rejected', 'assigned', 'all'].includes(tabId);
    
    // Reset all dropdown button styles first
    dropdownBtns.forEach(btn => {
        btn.style.background = 'rgba(255,255,255,0.2)';
        btn.style.color = 'white';
    });
    
    if (isTasksDropdownTab || isClosedDropdownTab) {
        // Find the correct dropdown button and highlight it
        const activeDropdownItem = document.querySelector(`.dropdown-item[data-tab="${tabId}"]`);
        if (activeDropdownItem) {
            activeDropdownItem.classList.add('active');
            // Find the parent dropdown button and highlight it
            const parentDropdown = activeDropdownItem.closest('.dropdown');
            const parentDropdownBtn = parentDropdown.querySelector('.dropdown-btn');
            if (parentDropdownBtn) {
                parentDropdownBtn.style.background = 'white';
                parentDropdownBtn.style.color = '#667eea';
            }
        }
    } else {
        // Highlight the regular tab button
        const activeTabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeTabBtn) {
            activeTabBtn.classList.add('active');
        }
    }
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Check if the target content container exists
    const targetContent = document.getElementById(tabId);
    if (!targetContent) {
        console.error(`Content container not found for tab: ${tabId}`);
        console.log('Available content containers:', Array.from(document.querySelectorAll('.tab-content')).map(el => el.id));
        
        // Try to create the content container if it's a host tab
        const hostMatch = tabId.match(/^host(\d+)-(.+)$/);
        if (hostMatch) {
            console.log(`Attempting to create missing content container for ${tabId}`);
            createHostContentContainers().then(() => {
                // Retry switching to the tab after creating containers
                const retryTarget = document.getElementById(tabId);
                if (retryTarget) {
                    retryTarget.classList.add('active');
                    currentTab = tabId;
                    loadVideos(tabId);
                } else {
                    console.error(`Still could not find content container for ${tabId} after creation attempt`);
                }
            }).catch(err => {
                console.error('Error creating content containers:', err);
            });
            return; // Exit early, will retry after container creation
        } else {
            console.error(`Cannot create content container for non-host tab: ${tabId}`);
            return; // Exit early to prevent further errors
        }
    }
    
    targetContent.classList.add('active');
    
    currentTab = tabId;
    
    // Load data for the new tab
    if (tabId === 'manage-people') {
        loadPeople();
        setupPeopleTabs(); // Setup people management tabs
    } else if (tabId === 'manage-tags') {
        loadTags();
    } else if (tabId === 'manage-admins') {
        initializeAdminManagement();
    } else if (tabId === 'all') {
        loadAllEntries();
    } else if (tabId === 'relevance' || tabId === 'trash') {
        loadVideos(tabId);
        // Update relevance and trash counts when switching to these tabs
        updateRelevanceCount();
    } else if (tabId !== 'add-topic' && tabId !== 'bulk-import') {
        loadVideos(tabId);
    }
}

// ===== API SERVICE CLASS =====
// Centralized API service to eliminate code duplication and provide consistent error handling
class ApiService {
    static async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                const error = new Error(data.error || `HTTP error! status: ${response.status}`);
                error.status = response.status;
                error.data = data;
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // GET request
    static async get(url) {
        return this.request(url, { method: 'GET' });
    }

    // POST request
    static async post(url, data = null) {
        const options = { method: 'POST' };
        if (data) {
            options.body = JSON.stringify(data);
        }
        return this.request(url, options);
    }

    // PUT request
    static async put(url, data = null) {
        const options = { method: 'PUT' };
        if (data) {
            options.body = JSON.stringify(data);
        }
        return this.request(url, options);
    }

    // DELETE request
    static async delete(url) {
        return this.request(url, { method: 'DELETE' });
    }

    // PATCH request
    static async patch(url, data = null) {
        const options = { method: 'PATCH' };
        if (data) {
            options.body = JSON.stringify(data);
        }
        return this.request(url, options);
    }

    // Specialized methods for common API patterns
    static async getHosts() {
        return this.get('/api/hosts');
    }

    static async getVideos(endpoint) {
        return this.get(endpoint);
    }

    static async getVideoCounts() {
        return this.get('/api/videos/counts');
    }

    static async getPeople() {
        return this.get('/api/people');
    }

    static async getAdmins() {
        return this.get('/api/admins');
    }

    static async getTags() {
        return this.get('/api/tags');
    }

    static async createVideo(videoData) {
        return this.post('/api/videos', videoData);
    }

    static async updateVideo(videoId, updateData) {
        return this.put(`/api/videos/${videoId}`, updateData);
    }

    static async deleteVideo(videoId) {
        return this.delete(`/api/videos/${videoId}`);
    }

    static async createPerson(personData) {
        return this.post('/api/people', personData);
    }

    static async updatePerson(personId, updateData) {
        return this.put(`/api/people/${personId}`, updateData);
    }

    static async deletePerson(personId) {
        return this.delete(`/api/people/${personId}`);
    }

    static async createAdmin(adminData) {
        return this.post('/api/admins', adminData);
    }

    static async updateAdminPassword(adminId, passwordData) {
        return this.put(`/api/admins/${adminId}/password`, passwordData);
    }

    static async deleteAdmin(adminId) {
        return this.delete(`/api/admins/${adminId}`);
    }

    static async createHost(hostData) {
        return this.post('/api/hosts', hostData);
    }

    static async updateHost(hostId, hostData) {
        return this.put(`/api/hosts/${hostId}`, hostData);
    }

    static async deleteHost(hostId) {
        return this.delete(`/api/hosts/${hostId}`);
    }

    static async checkDuplicateVideo(url) {
        return this.get(`/api/videos/check-duplicate?url=${encodeURIComponent(url)}`);
    }
}



// ===== MODAL COMPONENT CLASS =====
// Unified modal system to eliminate code duplication and provide consistent modal behavior
class Modal {
    constructor(modalId, options = {}) {
        this.modalId = modalId;
        this.options = {
            backdrop: true,
            keyboard: true,
            focus: true,
            ...options
        };
        this.modal = null;
        this.callback = null;
        this.isVisible = false;
        
        this.init();
    }
    
    init() {
        // Find existing modal or create if it doesn't exist
        this.modal = document.getElementById(this.modalId);
        if (!this.modal) {
            console.warn(`Modal with ID '${this.modalId}' not found`);
            return;
        }
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (!this.modal) return;
        
        // Close on backdrop click
        if (this.options.backdrop) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.hide();
                }
            });
        }
        
        // Close on escape key
        if (this.options.keyboard) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isVisible) {
                    this.hide();
                }
            });
        }
        
        // Close button handler
        const closeBtn = this.modal.querySelector('.close, [data-dismiss="modal"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
    }
    
    show(options = {}) {
        if (!this.modal) return;
        
        // Update modal content if provided
        if (options.title) {
            const titleEl = this.modal.querySelector('.modal-title, #confirmTitle, #noteModalTitle');
            if (titleEl) titleEl.textContent = options.title;
        }
        
        if (options.message || options.content) {
            const contentEl = this.modal.querySelector('.modal-body, #confirmMessage, #noteTextarea');
            if (contentEl) {
                if (contentEl.tagName === 'TEXTAREA') {
                    contentEl.value = options.content || '';
                } else {
                    contentEl.textContent = options.message || options.content || '';
                }
            }
        }
        
        // Store callback if provided
        if (options.callback) {
            this.callback = options.callback;
        }
        
        // Show modal
        this.modal.style.display = 'block';
        this.isVisible = true;
        
        // Focus on input if requested
        if (this.options.focus) {
            const focusEl = this.modal.querySelector('input, textarea');
            if (focusEl) {
                setTimeout(() => focusEl.focus(), 100);
            }
        }
        
        return this;
    }
    
    hide() {
        if (!this.modal) return;
        
        this.modal.style.display = 'none';
        this.isVisible = false;
        this.callback = null;
        
        return this;
    }
    
    onConfirm(callback) {
        this.callback = callback;
        return this;
    }
    
    executeCallback(data = null) {
        if (this.callback && typeof this.callback === 'function') {
            this.callback(data);
        }
        this.hide();
    }
    
    // ===== STATIC METHODS FOR COMMON MODAL PATTERNS =====
    // Unified modal patterns following DRY, KISS, and SOLID principles
    
    static confirm(title, message, callback) {
        const modal = new Modal('confirmModal');
        return modal.show({ title, message, callback });
    }
    
    static prompt(title, placeholder = '', callback) {
        const modal = new Modal('video-id-modal');
        return modal.show({ title, callback });
    }
    
    static note(videoId, action, existingNote = '', callback) {
        const modal = new Modal('noteModal');
        const title = `${action.charAt(0).toUpperCase() + action.slice(1)} Video - Add Note`;
        return modal.show({ title, content: existingNote, callback });
    }
    
    static pitch(videoId, pitchText) {
        // Create pitch modal dynamically if it doesn't exist
        let modal = document.getElementById('pitchModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'pitchModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">📄 Video Pitch</h3>
                        <span class="close" data-dismiss="modal">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div id="pitchModalContent"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        // Set content and show
        document.getElementById('pitchModalContent').textContent = pitchText;
        const pitchModal = new Modal('pitchModal');
        return pitchModal.show();
    }
    
    static tags(videoId, availableTags, selectedTagIds = [], callback) {
        const modal = new Modal('tagSelectionModal');
        
        // Render tag options
        const tagsList = document.getElementById('tagSelectionList');
        if (tagsList) {
            tagsList.innerHTML = availableTags.map(tag => `
                <div class="tag-option">
                    <input type="checkbox" id="tag-${tag.id}" value="${tag.id}" 
                           ${selectedTagIds.includes(tag.id) ? 'checked' : ''}>
                    <label for="tag-${tag.id}">${tag.name}</label>
                    <span class="tag-option-preview tag-preview" style="background-color: ${tag.color}">${tag.name}</span>
                </div>
            `).join('');
        }
        
        return modal.show({ callback });
    }
    
    static message(text, type = 'info', duration = 5000) {
        // Create temporary message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `temp-message temp-message-${type}`;
        messageDiv.textContent = text;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f44336' : '#4CAF50'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(messageDiv);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, duration);
        
        return messageDiv;
    }
}

// Global modal instances for backward compatibility
let confirmModal = null;
let noteModal = null;
let videoIdModal = null;

// Initialize modals when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    confirmModal = new Modal('confirmModal');
    noteModal = new Modal('noteModal');
    videoIdModal = new Modal('video-id-modal');
});

// ===== FORM VALIDATOR UTILITY CLASS =====
// Unified form validation system to eliminate validation duplication
class FormValidator {
    constructor(formElement, options = {}) {
        this.form = typeof formElement === 'string' ? document.getElementById(formElement) : formElement;
        this.options = {
            showErrors: true,
            errorClass: 'error',
            successClass: 'success',
            ...options
        };
        this.errors = [];
        this.rules = new Map();
    }
    
    // Add validation rule for a field
    addRule(fieldName, validator, errorMessage) {
        if (!this.rules.has(fieldName)) {
            this.rules.set(fieldName, []);
        }
        this.rules.get(fieldName).push({ validator, errorMessage });
        return this;
    }
    
    // Built-in validators
    static validators = {
        required: (value) => value && value.trim() !== '',
        email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        url: (value) => {
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }
        },
        minLength: (min) => (value) => value && value.length >= min,
        maxLength: (max) => (value) => !value || value.length <= max,
        numeric: (value) => !isNaN(value) && !isNaN(parseFloat(value)),
        integer: (value) => Number.isInteger(Number(value)),
        range: (min, max) => (value) => {
            const num = Number(value);
            return num >= min && num <= max;
        },
        pattern: (regex) => (value) => regex.test(value),
        custom: (fn) => fn
    };
    
    // Convenience methods for common validations
    required(fieldName, message = `${fieldName} is required`) {
        return this.addRule(fieldName, FormValidator.validators.required, message);
    }
    
    email(fieldName, message = 'Please enter a valid email address') {
        return this.addRule(fieldName, FormValidator.validators.email, message);
    }
    
    url(fieldName, message = 'Please enter a valid URL') {
        return this.addRule(fieldName, FormValidator.validators.url, message);
    }
    
    minLength(fieldName, min, message = `Must be at least ${min} characters`) {
        return this.addRule(fieldName, FormValidator.validators.minLength(min), message);
    }
    
    maxLength(fieldName, max, message = `Must be no more than ${max} characters`) {
        return this.addRule(fieldName, FormValidator.validators.maxLength(max), message);
    }
    
    numeric(fieldName, message = 'Must be a valid number') {
        return this.addRule(fieldName, FormValidator.validators.numeric, message);
    }
    
    integer(fieldName, message = 'Must be a whole number') {
        return this.addRule(fieldName, FormValidator.validators.integer, message);
    }
    
    range(fieldName, min, max, message = `Must be between ${min} and ${max}`) {
        return this.addRule(fieldName, FormValidator.validators.range(min, max), message);
    }
    
    pattern(fieldName, regex, message = 'Invalid format') {
        return this.addRule(fieldName, FormValidator.validators.pattern(regex), message);
    }
    
    custom(fieldName, validator, message) {
        return this.addRule(fieldName, validator, message);
    }
    
    // Get field value with trimming
    getFieldValue(fieldName) {
        const field = this.getField(fieldName);
        if (!field) return null;
        
        if (field.type === 'checkbox') {
            return field.checked;
        } else if (field.type === 'radio') {
            const checked = this.form.querySelector(`input[name="${fieldName}"]:checked`);
            return checked ? checked.value : null;
        } else {
            return field.value.trim();
        }
    }
    
    // Get field element
    getField(fieldName) {
        return this.form.querySelector(`[name="${fieldName}"], #${fieldName}`);
    }
    
    // Validate single field
    validateField(fieldName) {
        const rules = this.rules.get(fieldName);
        if (!rules) return true;
        
        const value = this.getFieldValue(fieldName);
        const field = this.getField(fieldName);
        
        // Clear previous errors for this field
        this.clearFieldError(fieldName);
        
        for (const rule of rules) {
            if (!rule.validator(value)) {
                this.addFieldError(fieldName, rule.errorMessage);
                return false;
            }
        }
        
        this.markFieldSuccess(fieldName);
        return true;
    }
    
    // Validate entire form
    validate() {
        this.errors = [];
        let isValid = true;
        
        for (const fieldName of this.rules.keys()) {
            if (!this.validateField(fieldName)) {
                isValid = false;
            }
        }
        
        return isValid;
    }
    
    // Get form data as object
    getData() {
        const data = {};
        for (const fieldName of this.rules.keys()) {
            data[fieldName] = this.getFieldValue(fieldName);
        }
        return data;
    }
    
    // Get all form data (including non-validated fields)
    getAllData() {
        const data = {};
        const formData = new FormData(this.form);
        
        for (const [key, value] of formData.entries()) {
            data[key] = typeof value === 'string' ? value.trim() : value;
        }
        
        // Also get fields by ID
        const inputs = this.form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.id && !data[input.id]) {
                if (input.type === 'checkbox') {
                    data[input.id] = input.checked;
                } else if (input.type === 'radio') {
                    if (input.checked) {
                        data[input.id] = input.value;
                    }
                } else {
                    data[input.id] = input.value.trim();
                }
            }
        });
        
        return data;
    }
    
    // Error handling methods
    addFieldError(fieldName, message) {
        this.errors.push({ field: fieldName, message });
        
        if (this.options.showErrors) {
            const field = this.getField(fieldName);
            if (field) {
                field.classList.add(this.options.errorClass);
                field.classList.remove(this.options.successClass);
                
                // Add error message display
                this.showFieldError(fieldName, message);
            }
        }
    }
    
    clearFieldError(fieldName) {
        const field = this.getField(fieldName);
        if (field) {
            field.classList.remove(this.options.errorClass);
            this.hideFieldError(fieldName);
        }
    }
    
    markFieldSuccess(fieldName) {
        const field = this.getField(fieldName);
        if (field) {
            field.classList.add(this.options.successClass);
            field.classList.remove(this.options.errorClass);
        }
    }
    
    showFieldError(fieldName, message) {
        let errorEl = this.form.querySelector(`.error-message[data-field="${fieldName}"]`);
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            errorEl.setAttribute('data-field', fieldName);
            errorEl.style.color = 'red';
            errorEl.style.fontSize = '12px';
            errorEl.style.marginTop = '4px';
            
            const field = this.getField(fieldName);
            if (field && field.parentNode) {
                field.parentNode.insertBefore(errorEl, field.nextSibling);
            }
        }
        errorEl.textContent = message;
    }
    
    hideFieldError(fieldName) {
        const errorEl = this.form.querySelector(`.error-message[data-field="${fieldName}"]`);
        if (errorEl) {
            errorEl.remove();
        }
    }
    
    // Clear all errors
    clearErrors() {
        this.errors = [];
        this.form.querySelectorAll(`.${this.options.errorClass}`).forEach(el => {
            el.classList.remove(this.options.errorClass);
        });
        this.form.querySelectorAll('.error-message').forEach(el => el.remove());
    }
    
    // Get error messages
    getErrors() {
        return this.errors;
    }
    
    getErrorMessages() {
        return this.errors.map(error => error.message);
    }
    
    // Show all errors as alert (backward compatibility)
    showErrorAlert() {
        if (this.errors.length > 0) {
            alert(this.getErrorMessages().join('\n'));
        }
    }
    
    // Static helper methods for common validation patterns
    static validateRequired(value, fieldName) {
        const trimmed = value ? value.trim() : '';
        if (!trimmed) {
            throw new Error(`${fieldName} is required`);
        }
        return trimmed;
    }
    
    static validateEmail(email) {
        const trimmed = email ? email.trim() : '';
        if (!trimmed) {
            throw new Error('Email is required');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            throw new Error('Please enter a valid email address');
        }
        return trimmed;
    }
    
    static validateUrl(url) {
        const trimmed = url ? url.trim() : '';
        if (!trimmed) {
            throw new Error('URL is required');
        }
        try {
            new URL(trimmed);
            return trimmed;
        } catch {
            throw new Error('Please enter a valid URL');
        }
    }
    
    static validateRange(value, min, max, fieldName = 'Value') {
        const num = Number(value);
        if (isNaN(num)) {
            throw new Error(`${fieldName} must be a number`);
        }
        if (num < min || num > max) {
            throw new Error(`${fieldName} must be between ${min} and ${max}`);
        }
        return num;
    }
}

// Load People
async function loadPeople() {
    try {
        // Load active people for forms and main list
        people = await ApiService.request('/api/people');
        updatePersonSelect();
        updatePeopleList();
        
        // Also load archived people if we're on the archived tab
        const currentPeopleTab = document.querySelector('.people-tab-btn.active')?.dataset.peopleTab;
        if (currentPeopleTab === 'archived') {
            await loadArchivedPeople();
        }
    } catch (error) {
        console.error('Failed to load people:', error);
    }
}

async function loadArchivedPeople() {
    try {
        const archivedPeople = await ApiService.get('/api/people?archived=true');
        updateArchivedPeopleList(archivedPeople);
    } catch (error) {
        console.error('Failed to load archived people:', error);
    }
}

function updatePersonSelect() {
    const select = document.getElementById('person-select');
    select.innerHTML = '<option value="">Select a person...</option>';
    
    people.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.name;
        select.appendChild(option);
    });
}

function updatePeopleList() {
    const container = document.getElementById('people-list');
    
    if (people.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No active people</h3><p>Add people who can submit video topics.</p></div>';
        return;
    }
    
    container.innerHTML = people.map(person => `
        <div class="person-item">
            <input type="text" value="${escapeHtml(person.name)}" 
                   onchange="updatePersonName(${person.id}, this.value)" 
                   class="person-name-input">
            <button onclick="archivePerson(${person.id})" 
                    class="btn btn-warning btn-small" 
                    title="Archive person (hide from forms)">
                📦 Archive
            </button>
            <button onclick="deletePerson(${person.id})" 
                    class="btn btn-danger btn-small" 
                    title="Permanently delete person">
                🗑️ Delete
            </button>
        </div>
    `).join('');
}

function updateArchivedPeopleList(archivedPeople) {
    const container = document.getElementById('archived-people-list');
    
    if (archivedPeople.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No archived people</h3><p>Archived people will appear here.</p></div>';
        return;
    }
    
    container.innerHTML = archivedPeople.map(person => `
        <div class="person-item">
            <span class="person-name-display">${escapeHtml(person.name)}</span>
            <button onclick="unarchivePerson(${person.id})" 
                    class="btn btn-success btn-small" 
                    title="Unarchive person (make active again)">
                📤 Unarchive
            </button>
            <button onclick="deletePerson(${person.id})" 
                    class="btn btn-danger btn-small" 
                    title="Permanently delete person">
                🗑️ Delete
            </button>
        </div>
    `).join('');
}

// Load Videos
async function loadVideos(status) {
    try {
        // Skip video loading for non-video tabs (host management, etc.)
        const nonVideoTabs = ['manage-hosts', 'manage-people', 'manage-admins', 'bulk-import'];
        if (nonVideoTabs.includes(status)) {
            console.log(`Skipping video loading for non-video tab: ${status}`);
            return;
        }
        
        console.log(`Loading ${status} videos...`);
        
        // Determine API endpoint based on status
        let apiEndpoint;
        let hostId;
        let isSystemWide = false;
        
        // Special handling for system-wide statuses
        if (status === 'relevance') {
            // Use the new system-wide relevance endpoint
            apiEndpoint = '/api/videos/system/relevance';
            isSystemWide = true;
            console.log('Using system-wide relevance endpoint');
        } else if (status === 'trash') {
            // Use the new system-wide trash endpoint
            apiEndpoint = '/api/videos/system/trash';
            isSystemWide = true;
            console.log('Using system-wide trash endpoint');
        } else {
            // Check if this is a host-specific tab (format: host{id}-{status})
            const hostMatch = status.match(/^host(\d+)-(.+)$/);
            
            if (hostMatch) {
                // Host-specific tabs: use generic host API endpoint for ALL hosts
                hostId = hostMatch[1];
                const hostStatus = hostMatch[2];
                apiEndpoint = `/api/videos/host/${hostId}/${hostStatus}`;
            } else {
                // Regular tabs (Host 1): also use generic endpoint for consistency
                hostId = '1';
                apiEndpoint = `/api/videos/host/1/${status}`;
            }
        }
        
        const response = await ApiService.request(apiEndpoint);
        console.log(`Received response for ${status}:`, response);
        
        // Handle different response formats:
        // System-wide relevance returns: { videos: [...], status: 'relevance', count: ..., isSystemWide: true }
        // Generic endpoint returns: { videos: [...], hostId: ..., status: ..., count: ... }
        // Legacy endpoints return: [...] (direct array)
        let videos;
        if (Array.isArray(response)) {
            // Legacy format (direct array)
            videos = response;
        } else if (response && Array.isArray(response.videos)) {
            // Generic format (object with videos property)
            videos = response.videos;
            isSystemWide = response.isSystemWide || false;
        } else {
            console.error('Unexpected response format:', response);
            videos = [];
        }
        
        console.log(`Processed ${videos.length} ${status} videos:`, videos);
        
        // Tags are now included in the API response - no need for separate calls
        renderVideos(videos, `${status}-videos`, status);
        console.log(`Rendered ${status} videos successfully`);
    } catch (error) {
        console.error(`Failed to load ${status} videos:`, error);
        // Update count to 0 on error
        updateViewCount(status, 0);
        // Show error in container
        const container = document.getElementById(`${status}-videos`);
        if (container) {
            container.innerHTML = `<div class="error-state"><h3>Error loading ${status} videos</h3><p>${error.message}</p></div>`;
        }
    }
}

// Update view count display
function updateViewCount(status, count) {
    const countElement = document.getElementById(`${status}-count`);
    if (countElement) {
        countElement.textContent = `(${count})`;
    }
}

function renderVideos(videos, containerId, status) {
    const container = document.getElementById(containerId);
    
    // Update view count
    updateViewCount(status, videos.length);
    
    if (videos.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No ${status} videos</h3><p>Videos will appear here when they reach this stage.</p></div>`;
        return;
    }
    
    container.innerHTML = videos.map(video => createVideoCard(video, status)).join('');
}

function createVideoCard(video, status) {
    const typeClass = video.type.toLowerCase();
    const score = video.score !== null ? video.score : '-';
    const relevanceRating = video.relevance_rating >= 0 ? video.relevance_rating : (status === 'relevance' ? '-1' : '');
    
    return `
        <div class="video-card ${typeClass}">
            <div class="video-header">
                <div class="video-info-icon">
                    <span class="info-icon">ℹ️</span>
                    <div class="info-tooltip">
                        <div class="tooltip-line"><strong>Added by:</strong> ${escapeHtml(video.added_by_name)}</div>
                        <div class="tooltip-line"><strong>Date:</strong> ${formatDate(video.link_added_on)}</div>
                    </div>
                </div>
            </div>
            
            <div class="video-type-column">
                <div class="video-type-pill">
                    <button class="video-type-btn ${typeClass}" onclick="toggleTypePill(${video.id})">
                        ${video.type}
                    </button>
                    <button class="type-alternative" id="type-alt-${video.id}" onclick="updateVideoType(${video.id}, '${video.type === 'Trending' ? 'General' : 'Trending'}')">
                        ${video.type === 'Trending' ? 'General' : 'Trending'}
                    </button>
                </div>
            </div>
            
            <div class="video-details">
                <div class="detail-item link-item">
                    <a href="${escapeHtml(video.link)}" target="_blank" class="link-icon" title="${escapeHtml(video.link)}">
                        🔗
                    </a>
                </div>
                
                ${(status === 'relevance' || status === 'trash') ? `
                    <div class="detail-item likes-item">
                        <span class="detail-label">Likes</span>
                        <span class="detail-value">${video.likes_count || 0}</span>
                    </div>
                    
                    <div class="detail-item relevance-item">
                        <span class="detail-label">Relevance</span>
                        <span class="detail-value">
                            <select onchange="updateRelevance(${video.id}, this.value)" style="width: 60px; padding: 2px 4px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="-1" ${relevanceRating === '-1' ? 'selected' : ''}>-1</option>
                                <option value="0" ${relevanceRating == 0 ? 'selected' : ''}>0</option>
                                <option value="1" ${relevanceRating == 1 ? 'selected' : ''}>1</option>
                                <option value="2" ${relevanceRating == 2 ? 'selected' : ''}>2</option>
                                <option value="3" ${relevanceRating == 3 ? 'selected' : ''}>3</option>
                            </select>
                        </span>
                    </div>
                    
                    <div class="detail-item score-item">
                        <span class="detail-value score">${score}</span>
                    </div>
                ` : `
                    <div class="detail-item score-item">
                        <span class="detail-value score-formula">${video.likes_count || 0} x ${relevanceRating >= 0 ? relevanceRating : 0} = ${score}</span>
                    </div>
                `}
                
                <div class="detail-item tags-item">
                    <span class="detail-value tags-cell" onclick="showTagModal(${video.id})">
                        <div class="tags-display" id="tags-${video.id}">
                            ${video.tags ? renderVideoTags(video.tags) : '<span class="tags-placeholder">#</span>'}
                        </div>
                    </span>
                </div>
                
                <div class="detail-item pitch-item">
                    <span class="detail-label">Pitch</span>
                    <span class="detail-value pitch-content" id="pitch-${video.id}">
                        ${renderPitchDisplay(video.pitch, video.id)}
                    </span>
                </div>
                
                ${getHostVideoIdValue(video, status) ? `
                    <div class="detail-item">
                        <span class="detail-label">Video ID</span>
                        <span class="detail-value">
                            <input type="text" value="${escapeHtml(getHostVideoIdValue(video, status))}" 
                                   onchange="updateVideoId(${video.id}, this.value)" 
                                   style="width: 60px; padding: 2px 4px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px;">
                            <button onclick="hostAction(${getHostFromStatus(status)}, ${video.id}, 'clearVideoId')" 
                                    style="margin-left: 4px; padding: 1px 4px; font-size: 10px; background: #dc3545; color: white; border: none; border-radius: 2px; cursor: pointer;" 
                                    title="Clear Video ID">×</button>
                        </span>
                    </div>
                ` : ''}
                
                <div class="detail-item note-item">
                    <span class="detail-label">Note</span>
                    <span class="detail-value">
                        ${renderNoteDisplay(getHostNoteValue(video, status), video.id)}
                    </span>
                </div>
            </div>
            
            <div class="video-actions">
                ${getVideoActions(video, status)}
            </div>
        </div>
    `;
}

// Updated getVideoActions to use the unified dynamic button generation system
function getVideoActions(video, status) {
    // Use the new unified system for all hosts and statuses
    return getUnifiedVideoActions(video, status);
}



// Form Setup
function setupForms() {
    // Add Video Form
    document.getElementById('add-video-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            added_by: parseInt(document.getElementById('person-select').value),
            link: document.getElementById('video-link').value,
            type: document.getElementById('video-type').value,
            likes_count: parseInt(document.getElementById('likes-count').value),
            pitch: document.getElementById('pitch').value.trim() || null
        };
        
        try {
            await ApiService.request('/api/videos', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            // Reset form
            this.reset();
            showSuccessNotification('Video topic added successfully!');
            
            // Refresh pending videos if that tab is active
            if (currentTab === 'pending') {
                loadVideos('pending');
            }
        } catch (error) {
            console.error('Failed to add video:', error);
            
            // Show user-friendly error message for duplicate URLs
            if (error.message && error.message.includes('already exists')) {
                alert('This video URL already exists in the system. Please check if it has been previously added.');
            } else {
                alert('Failed to add video. Please try again.');
            }
        }
    });
    
    // Setup real-time duplicate detection for video URL input
    const videoLinkInput = document.getElementById('video-link');
    if (videoLinkInput) {
        videoLinkInput.addEventListener('input', function(e) {
            const url = e.target.value.trim();
            checkForDuplicates(url, e.target);
        });
    }
    
    // Add Person Form
    document.getElementById('add-person-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('person-name').value.trim();
        
        try {
            await ApiService.request('/api/people', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            
            // Reset form and reload people
            this.reset();
            await loadPeople();
            showSuccessNotification('Person added successfully!');
        } catch (error) {
            console.error('Failed to add person:', error);
        }
    });
    
    // Add Tag Form
    const addTagForm = document.getElementById('add-tag-form');
    if (addTagForm) {
        addTagForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('tag-name').value.trim();
            const color = document.getElementById('tag-color').value;
            
            if (await addTag(name, color)) {
                // Reset form on success
                this.reset();
                document.getElementById('tag-color').value = '#007bff'; // Reset to default color
            }
        });
    }
}

// People Management Functions
async function updatePersonName(personId, newName) {
    const trimmedName = newName.trim();
    
    if (!trimmedName) {
        alert('Person name cannot be empty');
        await loadPeople(); // Reload to reset the input
        return;
    }
    
    try {
        await ApiService.request(`/api/people/${personId}`, {
            method: 'PUT',
            body: JSON.stringify({ name: trimmedName })
        });
        
        // Reload people and person select
        await loadPeople();
    } catch (error) {
        console.error('Failed to update person:', error);
        alert('Failed to update person name');
        await loadPeople(); // Reload to reset the input
    }
}

async function deletePerson(personId) {
    console.log('deletePerson called with ID:', personId);
    
    // Show custom confirmation modal
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmation-modal');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');
        const message = document.getElementById('modal-message');
        
        message.textContent = 'Are you sure you want to delete this person? This action cannot be undone if they have no videos.';
        modal.style.display = 'block';
        
        const handleConfirm = async () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            await performDelete(personId);
            resolve();
        };
        
        const handleCancel = () => {
            console.log('Delete cancelled by user');
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve();
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

async function performDelete(personId) {
    
    console.log('Delete confirmed, making API call...');
    try {
        console.log('Calling API:', `/api/people/${personId}`);
        
        const data = await ApiService.deletePerson(personId);
        console.log('Response data:', data);
        
        console.log('API call successful:', data);
        
        // Reload people and person select
        console.log('Reloading people list...');
        await loadPeople();
        console.log('People list reloaded');
        
        // Show success message without alert popup
        console.log('Person deleted successfully!');
        
    } catch (error) {
        console.error('Failed to delete person:', error);
        console.error('Error details:', error.message);
        
        // Show user-friendly error message
        showTemporaryMessage('Failed to delete person: ' + (error.message || 'Unknown error'), 'error');
    }
}

// Setup people management tabs
function setupPeopleTabs() {
    const peopleTabButtons = document.querySelectorAll('.people-tab-btn');
    
    peopleTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabType = this.dataset.peopleTab;
            
            // Update tab buttons
            peopleTabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update sections
            document.querySelectorAll('.people-section').forEach(section => {
                section.classList.remove('active');
            });
            
            if (tabType === 'active') {
                document.getElementById('active-people-section').classList.add('active');
                loadPeople(); // Load active people
            } else if (tabType === 'archived') {
                document.getElementById('archived-people-section').classList.add('active');
                loadArchivedPeople(); // Load archived people
            }
        });
    });
}

// Archive person
async function archivePerson(personId) {
    if (!confirm('Are you sure you want to archive this person? They will be hidden from all forms but remain in the database.')) {
        return;
    }
    
    try {
        await ApiService.request(`/api/people/${personId}/archive`, {
            method: 'PUT'
        });
        
        showSuccessNotification('Person archived successfully!');
        await loadPeople();
    } catch (error) {
        console.error('Failed to archive person:', error);
        alert('Failed to archive person. Please try again.');
    }
}

// Unarchive person
async function unarchivePerson(personId) {
    try {
        await ApiService.request(`/api/people/${personId}/unarchive`, {
            method: 'PUT'
        });
        
        showSuccessNotification('Person unarchived successfully!');
        await loadPeople();
        await loadArchivedPeople();
    } catch (error) {
        console.error('Failed to unarchive person:', error);
        alert('Failed to unarchive person. Please try again.');
    }
}

// Legacy wrapper for backward compatibility
function showTemporaryMessage(message, type = 'info') {
    return Modal.message(message, type);
}

// Modal Setup
function setupModals() {
    console.log('Setting up modals...');
    
    // Confirmation Modal - with null checks
    const modalCancel = document.getElementById('confirmNo');
    const modalConfirm = document.getElementById('confirmYes');
    const confirmationModal = document.getElementById('confirmModal');
    
    if (modalCancel && confirmationModal) {
        modalCancel.addEventListener('click', function() {
            confirmationModal.style.display = 'none';
            confirmationCallback = null;
        });
    } else {
        console.warn('Confirmation modal elements not found');
    }
    
    if (modalConfirm && confirmationModal) {
        modalConfirm.addEventListener('click', function() {
            if (confirmationCallback) {
                confirmationCallback();
            }
            confirmationModal.style.display = 'none';
            confirmationCallback = null;
        });
    } else {
        console.warn('Confirmation modal confirm button not found');
    }
    
    // Video ID Modal - with null checks
    const videoIdCancel = document.getElementById('video-id-cancel');
    const videoIdConfirm = document.getElementById('video-id-confirm');
    const videoIdModal = document.getElementById('video-id-modal');
    const videoIdInput = document.getElementById('video-id-input');
    
    if (videoIdCancel && videoIdModal && videoIdInput) {
        videoIdCancel.addEventListener('click', function() {
            videoIdModal.style.display = 'none';
            videoIdInput.value = '';
            videoIdCallback = null;
        });
    } else {
        console.warn('Video ID modal cancel elements not found');
    }
    
    if (videoIdConfirm && videoIdModal && videoIdInput) {
        videoIdConfirm.addEventListener('click', function() {
            const videoId = videoIdInput.value.trim();
            if (videoId && videoIdCallback) {
                videoIdCallback(videoId);
            }
            
            // Close the modal after submission
            videoIdModal.style.display = 'none';
            videoIdInput.value = '';
            videoIdCallback = null;
        });
    } else {
        console.warn('Video ID modal confirm elements not found');
    }
    
    console.log('Modal setup completed');
}

// Video Actions
async function updateRelevance(videoId, relevanceRating) {
    try {
        // Show spinner or indicator
        showNotification('Updating relevance...', 'info');
        
        // Call the API to update relevance
        await ApiService.request(`/api/videos/${videoId}/relevance`, {
            method: 'PUT',
            body: JSON.stringify({ relevance_rating: parseInt(relevanceRating) })
        });
        
        // Handle different rating outcomes
        if (relevanceRating >= 0 && relevanceRating <= 3) {
            // Update relevance count immediately
            updateRelevanceCount();
            
            // If we're in the relevance view, we need to refresh it to remove the rated video
            if (currentTab === 'relevance') {
                loadVideos('relevance');
            }
            
            if (relevanceRating === 0) {
                // Rating 0: Video moves to Trash (system-wide)
                setTimeout(() => {
                    // If we're in the trash view, refresh it to show the newly trashed video
                    if (currentTab === 'trash') {
                        loadVideos('trash');
                    }
                    
                    // Update button counts for all sections
                    updateButtonCounts();
                    
                    showNotification('Video moved to Trash (rating 0).', 'success');
                }, 300);
            } else if (relevanceRating >= 1 && relevanceRating <= 3) {
                // Rating 1-3: Video moves to pending for all hosts
                setTimeout(() => {
                    // Refresh the pending view for Host 1
                    if (currentTab === 'pending') {
                        loadVideos('pending');
                    }
                    
                    // Refresh pending views for all other hosts
                    const hostTabs = Object.keys(hosts).map(hostId => `host${hostId}-pending`);
                    if (hostTabs.includes(currentTab)) {
                        loadVideos(currentTab);
                    }
                    
                    // Update button counts for all sections
                    updateButtonCounts();
                    
                    showNotification('Relevance updated! Video moved to pending for all hosts.', 'success');
                }, 300);
            }
        } else {
            // Just refresh the current view
            loadVideos(currentTab);
            showNotification('Relevance updated!', 'success');
        }
    } catch (error) {
        console.error('Failed to update relevance:', error);
        showNotification('Failed to update relevance. Please try again.', 'error');
    }
}

async function updateVideoId(videoId, videoIdText) {
    try {
        // Detect host from current tab to use unified endpoint
        const hostId = getHostFromTab(currentTab);
        const endpoint = getHostStatusEndpoint(videoId, hostId);
        
        await ApiService.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify({ 
                status: 'assigned',
                video_id_text: videoIdText.trim()
            })
        });
        
        // Refresh current view
        loadVideos(currentTab);
    } catch (error) {
        console.error('Failed to update video ID:', error);
    }
}

async function clearVideoId(videoId) {
    try {
        // Detect host from current tab to use unified endpoint
        const hostId = getHostFromTab(currentTab);
        const endpoint = getHostStatusEndpoint(videoId, hostId);
        
        await ApiService.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify({ 
                status: 'accepted',
                video_id_text: null
            })
        });
        
        // Refresh current view
        loadVideos(currentTab);
    } catch (error) {
        console.error('Failed to clear video ID:', error);
    }
}



// Generic Host Action Function (Phase 1.3: Parallel Implementation)
// This function can handle accept/reject/assign actions for any host
// It works alongside existing functions for testing and gradual migration

async function hostAction(hostId, videoId, action, options = {}) {
    try {
        const config = getHostConfig(hostId);
        if (!config) {
            console.error(`Invalid host ID: ${hostId}`);
            return;
        }

        console.log(`[hostAction] Host ${hostId} (${config.name}): ${action} on video ${videoId}`);

        switch(action) {
            case 'accept':
                await hostActionAccept(hostId, videoId);
                break;
            case 'reject':
                await hostActionReject(hostId, videoId);
                break;
            case 'assign':
                await hostActionAssign(hostId, videoId);
                break;
            case 'pending':
                await hostActionPending(hostId, videoId);
                break;
            case 'clearVideoId':
                await hostActionClearVideoId(hostId, videoId);
                break;
            default:
                console.error(`Unknown action: ${action}`);
        }
    } catch (error) {
        console.error(`[hostAction] Error in host ${hostId} action ${action}:`, error);
    }
}

// Helper function for accept action
async function hostActionAccept(hostId, videoId) {
    const config = getHostConfig(hostId);
    
    // Accept/Reject buttons now call showNoteModal directly - this function is for other uses
    showNoteModal(videoId, 'accept');
}

// Helper function for reject action
async function hostActionReject(hostId, videoId) {
    const config = getHostConfig(hostId);
    
    // Accept/Reject buttons now call showNoteModal directly - this function is for other uses
    showNoteModal(videoId, 'reject');
}

// Helper function for assign action
async function hostActionAssign(hostId, videoId) {
    const config = getHostConfig(hostId);
    const endpoint = getHostApiEndpoint(hostId, videoId);
    
    try {
        const videoIdText = prompt('Enter Video ID:');
        if (videoIdText) {
            const updateData = { 
                status: 'assigned',
                video_id_text: videoIdText
            };
            
            await ApiService.request(endpoint, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            loadVideos(currentTab);
            updateButtonCounts();
        }
    } catch (error) {
        console.error(`[hostActionAssign] Error for host ${hostId}:`, error);
    }
}

// Helper function for pending action
async function hostActionPending(hostId, videoId) {
    const config = getHostConfig(hostId);
    const endpoint = getHostApiEndpoint(hostId, videoId);
    
    try {
        await ApiService.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify({ status: 'pending' })
        });
        
        loadVideos(currentTab);
        updateButtonCounts();
    } catch (error) {
        console.error(`[hostActionPending] Error for host ${hostId}:`, error);
    }
}

// Helper function for clear video ID action
async function hostActionClearVideoId(hostId, videoId) {
    const config = getHostConfig(hostId);
    const endpoint = getHostApiEndpoint(hostId, videoId);
    
    try {
        await ApiService.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify({ 
                status: 'accepted',
                video_id_text: null
            })
        });
        
        loadVideos(currentTab);
        updateButtonCounts();
    } catch (error) {
        console.error(`[hostActionClearVideoId] Error for host ${hostId}:`, error);
    }
}

// ===== UNIFIED HOST ACTION FUNCTIONS =====
// All legacy duplicate functions replaced with unified hostAction() calls

// Host 1 Action Functions - now use unified system
async function acceptVideo(videoId) {
    return hostActionAccept(1, videoId);
}

async function rejectVideo(videoId) {
    return hostActionReject(1, videoId);
}

function assignVideoId(videoId) {
    return hostActionAssign(1, videoId);
}

async function revertToPending(videoId) {
    return hostActionPending(1, videoId);
}

async function revertToAccepted(videoId) {
    return hostAction(1, videoId, 'accept');
}

function deleteVideo(videoId) {
    console.log('Delete video called for ID:', videoId);
    showConfirmation(
        'Delete Video',
        'Are you sure you want to permanently delete this video? This action cannot be undone.',
        async () => {
            try {
                console.log('Deleting video with ID:', videoId);
                const response = await ApiService.request(`/api/videos/${videoId}`, {
                    method: 'DELETE'
                });
                console.log('Delete response:', response);
                showSuccessNotification('Video deleted successfully');
                loadVideos(currentTab);
                updateButtonCounts(); // Update counts after deletion
            } catch (error) {
                console.error('Failed to delete video:', error);
                alert(`Error deleting video: ${error.message || 'Unknown error'}`);
            }
        }
    );
}

// Modal Functions
// Refactored modal functions using unified Modal component
function showConfirmation(title, message, callback) {
    // Set global callback for legacy event handlers
    confirmationCallback = callback;
    
    if (confirmModal) {
        confirmModal.show({ title, message, callback });
    } else {
        // Fallback for immediate calls before DOM ready
        Modal.confirm(title, message, callback);
    }
}

function showVideoIdInput(callback) {
    if (videoIdModal) {
        videoIdModal.show({ callback });
        // Focus on the input field
        const input = document.getElementById('video-id-input');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    } else {
        // Fallback for immediate calls before DOM ready
        Modal.prompt('Enter Video ID', '', callback);
    }
}

// Export Functions
function exportCSV(status) {
    const link = document.createElement('a');
    
    if (status === 'all') {
        // For All view, export all entries
        link.href = '/api/export/all';
        link.download = 'all_database_entries.csv';
    } else {
        // For specific status views
        link.href = `/api/export/${status}`;
        link.download = `${status}_videos.csv`;
    }
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function truncateName(name) {
    if (name.length <= 10) {
        return escapeHtml(name);
    }
    return escapeHtml(name.substring(0, 10)) + '...';
}

function truncateUrl(url, maxLength = 50) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
}

// Bulk Import Functions
let parsedBulkData = [];

function previewBulkData() {
    const bulkData = document.getElementById('bulk-data').value.trim();
    const previewDiv = document.getElementById('bulk-preview');
    const tableDiv = document.getElementById('bulk-preview-table');
    const errorsDiv = document.getElementById('bulk-validation-errors');
    const submitBtn = document.getElementById('bulk-submit-btn');
    
    if (!bulkData) {
        alert('Please paste some data first');
        return;
    }
    
    // Parse the data (tab-separated values from Google Sheets)
    const lines = bulkData.split('\n').filter(line => line.trim());
    parsedBulkData = [];
    const errors = [];
    
    lines.forEach((line, index) => {
        const columns = line.split('\t');
        const rowNum = index + 1;
        
        if (columns.length < 4) {
            errors.push(`Row ${rowNum}: Expected 4-6 columns (Name, Link, Type, Likes, Pitch, Relevance), found ${columns.length}`);
            return;
        }
        
        const [name, link, type, likes, pitch, relevance] = columns.map(col => col.trim());
        
        // Validation
        if (!name) {
            errors.push(`Row ${rowNum}: Name is required`);
        }
        if (!link) {
            errors.push(`Row ${rowNum}: Link is required`);
        } else {
            try {
                new URL(link);
            } catch {
                errors.push(`Row ${rowNum}: Invalid URL format`);
            }
        }
        if (!type || !['Trending', 'General'].includes(type)) {
            errors.push(`Row ${rowNum}: Type must be 'Trending' or 'General'`);
        }
        if (likes && isNaN(parseInt(likes))) {
            errors.push(`Row ${rowNum}: Likes count must be a number`);
        }
        if (relevance && relevance !== '' && (isNaN(parseInt(relevance)) || parseInt(relevance) < 0 || parseInt(relevance) > 3)) {
            errors.push(`Row ${rowNum}: Relevance must be empty or a number between 0-3`);
        }
        
        parsedBulkData.push({
            name,
            link,
            type,
            likes: likes ? parseInt(likes) : 0,
            relevance: relevance && relevance !== '' ? parseInt(relevance) : null,
            pitch: pitch || null,
            rowNum
        });
    });
    
    // Display preview table
    if (parsedBulkData.length > 0) {
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Row</th>
                        <th>Name</th>
                        <th>Link</th>
                        <th>Type</th>
                        <th>Likes</th>
                        <th>Pitch</th>
                        <th>Relevance</th>
                        <th>Destination</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        parsedBulkData.forEach(row => {
            const relevanceDisplay = row.relevance !== null ? row.relevance : '-';
            const destination = row.relevance !== null ? '🟡 Pending' : '🎯 Relevance';
            const pitchDisplay = row.pitch ? (row.pitch.length > 30 ? row.pitch.substring(0, 30) + '...' : row.pitch) : '-';
            tableHTML += `
                <tr>
                    <td>${row.rowNum}</td>
                    <td>${escapeHtml(row.name)}</td>
                    <td><a href="${escapeHtml(row.link)}" target="_blank">${truncateUrl(row.link, 40)}</a></td>
                    <td>${escapeHtml(row.type)}</td>
                    <td>${row.likes}</td>
                    <td title="${escapeHtml(row.pitch || '')}">${escapeHtml(pitchDisplay)}</td>
                    <td>${relevanceDisplay}</td>
                    <td>${destination}</td>
                </tr>
            `;
        });
        
        tableHTML += '</tbody></table>';
        tableDiv.innerHTML = tableHTML;
    }
    
    // Display errors
    if (errors.length > 0) {
        errorsDiv.innerHTML = '<h4>Validation Errors:</h4>' + 
            errors.map(error => `<div class="error-item">${escapeHtml(error)}</div>`).join('');
        submitBtn.disabled = true;
    } else {
        errorsDiv.innerHTML = '<div style="color: #28a745; font-weight: 600;">✅ All data looks good!</div>';
        submitBtn.disabled = false;
    }
    
    previewDiv.style.display = 'block';
}

async function submitBulkData() {
    if (parsedBulkData.length === 0) {
        alert('Please preview the data first');
        return;
    }
    
    const submitBtn = document.getElementById('bulk-submit-btn');
    const resultsDiv = document.getElementById('bulk-results');
    const resultsContent = document.getElementById('bulk-results-content');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Submit each video
    for (const row of parsedBulkData) {
        try {
            // Find person by name or create if doesn't exist
            let person = people.find(p => p.name.toLowerCase() === row.name.toLowerCase());
            
            if (!person) {
                // Create new person automatically
                try {
                    const newPerson = await ApiService.createPerson({ name: row.name });
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
            
            const videoData = {
                added_by: person.id,
                link: row.link,
                type: row.type,
                likes_count: row.likes,
                relevance_rating: row.relevance !== null ? row.relevance : -1,
                pitch: row.pitch || null
                // Note: Removed 'status' parameter - let backend handle status based on relevance_rating
                // relevance_rating = -1 -> relevance_status = 'relevance', host columns = null
                // relevance_rating 0-3 -> relevance_status = null, host columns = 'pending'
            };
            
            try {
                await ApiService.createVideo(videoData);
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
        } catch (error) {
            results.push({
                row: row.rowNum,
                status: 'error',
                message: `Network error: ${error.message}`
            });
            errorCount++;
        }
    }
    
    // Display results
    let resultsHTML = `
        <div style="margin-bottom: 15px;">
            <strong>Import Complete:</strong> ${successCount} successful, ${skippedCount} skipped, ${errorCount} errors
        </div>
    `;
    
    results.forEach(result => {
        let className = 'error-item'; // default
        if (result.status === 'success') {
            className = 'success-item';
        } else if (result.status === 'skipped') {
            className = 'skipped-item';
        }
        resultsHTML += `<div class="${className}">Row ${result.row}: ${escapeHtml(result.message)}</div>`;
    });
    
    resultsContent.innerHTML = resultsHTML;
    resultsDiv.style.display = 'block';
    
    // Reset form if all successful
    if (errorCount === 0) {
        document.getElementById('bulk-data').value = '';
        document.getElementById('bulk-preview').style.display = 'none';
        parsedBulkData = [];
        
        // Refresh the pending videos view
        if (currentTab === 'pending') {
            loadVideos('pending');
        }
    }
    
    submitBtn.disabled = false;
    submitBtn.textContent = '📤 Submit All Topics';
}

// Admin Management Functions

// Load and display admins
async function loadAdmins() {
    try {
        const admins = await ApiService.getAdmins();
        
        const adminList = document.getElementById('admin-list');
        
        if (admins.length === 0) {
            adminList.innerHTML = '<div class="admin-empty">No admins configured yet. Add the first admin above.</div>';
            return;
        }
        
        adminList.innerHTML = admins.map(admin => {
            const addedDate = new Date(admin.created_at).toLocaleDateString();
            const lastLogin = admin.last_login ? new Date(admin.last_login).toLocaleDateString() : 'Never';
            
            return `
                <div class="admin-item">
                    <div class="admin-info">
                        <div class="admin-email">${admin.email}</div>
                        ${admin.name ? `<div class="admin-name">${admin.name}</div>` : ''}
                        <div class="admin-meta">
                            Added: ${addedDate} | Last login: ${lastLogin}
                        </div>
                    </div>
                    <div class="admin-actions">
                        <button class="btn btn-secondary" onclick="changePassword(${admin.id}, '${admin.email}')" style="font-size: 12px; padding: 4px 8px; margin-right: 5px;">
                            🔑 Change Password
                        </button>
                        <button class="btn-remove-admin" onclick="removeAdmin(${admin.id}, '${admin.email}')">
                            🗑️ Remove
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading admins:', error);
        showNotification('Failed to load admins', 'error');
    }
}

// Add new admin
async function addAdmin(email, name, password) {
    try {
        await ApiService.createAdmin({ email, name, password });
        showNotification('Admin added successfully', 'success');
        loadAdmins();
        return true;
    } catch (error) {
        if (error.status === 409) {
            showNotification('Admin with this email already exists', 'error');
        } else {
            showNotification(error.message || 'Failed to add admin', 'error');
        }
        console.error('Error adding admin:', error);
        return false;
    }
}

// Change admin password
async function changePassword(adminId, email) {
    const newPassword = prompt(`Enter new password for ${email}:`);
    
    if (!newPassword) return;
    
    if (newPassword.length < 4) {
        showNotification('Password must be at least 4 characters long', 'error');
        return;
    }
    
    try {
        await ApiService.updateAdminPassword(adminId, { password: newPassword });
        
        showNotification('Password changed successfully', 'success');
    } catch (error) {
        console.error('Error changing password:', error);
        showNotification('Failed to change password', 'error');
    }
}

// Remove admin with confirmation
async function removeAdmin(adminId, email) {
    const confirmed = await showConfirmation(
        'Remove Admin',
        `Are you sure you want to remove admin access for "${email}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
        await ApiService.deleteAdmin(adminId);
        showNotification('Admin removed successfully', 'success');
        loadAdmins();
    } catch (error) {
        console.error('Error removing admin:', error);
        showNotification('Failed to remove admin', 'error');
    }
}

// Initialize admin management when tab is loaded
function initializeAdminManagement() {
    const addAdminForm = document.getElementById('add-admin-form');
    if (addAdminForm) {
        addAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Create validator for the admin form
            const validator = new FormValidator(addAdminForm)
                .required('admin-email', 'Email is required')
                .email('admin-email', 'Please enter a valid email address')
                .required('admin-password', 'Password is required')
                .minLength('admin-password', 4, 'Password must be at least 4 characters long');
            
            if (validator.validate()) {
                const data = validator.getAllData();
                const success = await addAdmin(
                    data['admin-email'], 
                    data['admin-name'] || null, 
                    data['admin-password']
                );
                if (success) {
                    // Clear form on success
                    addAdminForm.reset();
                    validator.clearErrors();
                }
            } else {
                // Show first error as notification
                const errors = validator.getErrorMessages();
                if (errors.length > 0) {
                    showNotification(errors[0], 'error');
                }
            }
        });
    }
    
    loadAdmins();
}

// Video Type Pill Functions
function toggleTypePill(videoId) {
    const alternative = document.getElementById(`type-alt-${videoId}`);
    const allAlternatives = document.querySelectorAll('.type-alternative');
    
    // Close all other alternatives
    allAlternatives.forEach(alt => {
        if (alt !== alternative) {
            alt.classList.remove('active');
        }
    });
    
    // Toggle current alternative
    alternative.classList.toggle('active');
    
    // Close alternative when clicking outside
    document.addEventListener('click', function closeAlternative(e) {
        if (!e.target.closest('.video-type-pill')) {
            alternative.classList.remove('active');
            document.removeEventListener('click', closeAlternative);
        }
    });
}

async function updateVideoType(videoId, newType) {
    try {
        const response = await ApiService.request(`/api/videos/${videoId}/type`, {
            method: 'PUT',
            body: JSON.stringify({ type: newType })
        });
        
        // Close the alternative
        const alternative = document.getElementById(`type-alt-${videoId}`);
        alternative.classList.remove('active');
        
        // Reload the current view to show updated type
        loadVideos(currentTab);
        
        showNotification(`Video type updated to ${newType}`, 'success');
    } catch (error) {
        console.error('Failed to update video type:', error);
        showNotification('Failed to update video type', 'error');
    }
}

// Video code extraction function (frontend version)
function extractVideoCode(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    
    // YouTube patterns
    const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,  // Regular and short URLs
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,                    // YouTube Shorts
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,                     // Embedded videos
        /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/                 // Mobile URLs
    ];
    
    // Instagram patterns
    const instagramPatterns = [
        /instagram\.com\/reel\/([a-zA-Z0-9_-]{11})/,                    // Instagram Reels
        /instagram\.com\/p\/([a-zA-Z0-9_-]{11})/,                       // Instagram Posts
        /instagram\.com\/stories\/[^\/]+\/([a-zA-Z0-9_-]{11})/          // Instagram Stories
    ];
    
    // Try YouTube patterns first
    for (const pattern of youtubePatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    // Try Instagram patterns
    for (const pattern of instagramPatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    // No pattern matched
    return null;
}

// Real-time duplicate detection for video URL input
let duplicateCheckTimeout;
async function checkForDuplicates(url, inputElement) {
    // Clear previous timeout
    if (duplicateCheckTimeout) {
        clearTimeout(duplicateCheckTimeout);
    }
    
    // Remove existing duplicate warning
    const existingWarning = inputElement.parentNode.querySelector('.duplicate-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    // Reset input styling
    inputElement.classList.remove('duplicate-input');
    
    if (!url || url.length < 10) {
        return; // Too short to be a valid URL
    }
    
    // Debounce the check
    duplicateCheckTimeout = setTimeout(async () => {
        try {
            const videoCode = extractVideoCode(url);
            
            // Check for duplicates via API
            let checkUrl;
            if (videoCode) {
                checkUrl = `/api/videos/check-duplicate?video_code=${encodeURIComponent(videoCode)}`;
            } else {
                checkUrl = `/api/videos/check-duplicate?url=${encodeURIComponent(url)}`;
            }
            
            const result = await ApiService.get(checkUrl);
            
            if (result.isDuplicate) {
                // Show duplicate warning
                const warning = document.createElement('div');
                warning.className = 'duplicate-warning';
                warning.innerHTML = `
                    <span class="warning-icon">⚠️</span>
                    <span class="warning-text">
                        ${videoCode ? 
                            `This video already exists (ID: ${videoCode}). Existing URL: <a href="${result.existingUrl}" target="_blank">${result.existingUrl}</a>` :
                            'This URL already exists in the system'
                        }
                    </span>
                `;
                
                inputElement.parentNode.appendChild(warning);
                inputElement.classList.add('duplicate-input');
            }
        } catch (error) {
            console.error('Duplicate check failed:', error);
        }
    }, 500); // 500ms debounce
}

// All View Functions
let allEntriesData = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';

// Multi-select components for 'all' view
let multiSelectManager = null;
let bulkActionBar = null;
let checkboxColumn = null;

/**
 * Initialize multi-select components for the 'all' view
 * Following Clean Code principles: Single responsibility, clear initialization
 */
function initializeMultiSelectComponents() {
    // Initialize checkbox column component
    checkboxColumn = new CheckboxColumn({
        headerCheckboxId: 'select-all-checkbox',
        rowCheckboxClass: 'row-checkbox',
        headerCheckboxClass: 'select-all-checkbox'
    });
    
    // Initialize bulk action bar
    bulkActionBar = new BulkActionBar('bulk-action-container', {
        onDelete: handleBulkDelete,
        onClear: handleClearSelection
    });
    
    // Initialize multi-select manager
    multiSelectManager = new MultiSelectManager({
        checkboxSelector: '.row-checkbox',
        selectAllSelector: '.select-all-checkbox',
        bulkActionBarSelector: '.bulk-action-bar',
        onSelectionChange: handleSelectionChange
    });
    
    console.log('[Multi-Select] Components initialized for all view');
}

/**
 * Handle selection change events
 * @param {Object} selectionState - Current selection state
 */
function handleSelectionChange(selectionState) {
    const { selectedCount, hasSelection } = selectionState;
    
    if (bulkActionBar) {
        bulkActionBar.updateState(selectionState);
    }
    
    // Update row visual state
    updateRowSelectionVisuals(selectionState.selectedIds);
    
    console.log(`[Multi-Select] Selection changed: ${selectedCount} items selected`);
}

/**
 * Handle bulk delete operation
 */
async function handleBulkDelete() {
    if (!multiSelectManager || !multiSelectManager.hasSelection()) {
        return;
    }
    
    const selectedIds = multiSelectManager.getSelectedIds();
    const selectedCount = selectedIds.length;
    
    // Show confirmation modal
    const confirmed = await Modal.confirm(
        'Confirm Bulk Delete',
        `Are you sure you want to delete ${selectedCount} selected video${selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`,
        'Delete All',
        'Cancel'
    );
    
    if (!confirmed) return;
    
    try {
        // Set loading state
        if (bulkActionBar) {
            bulkActionBar.setLoading(true);
        }
        
        // Perform bulk delete
        const result = await ApiService.request('/api/videos/bulk', {
            method: 'DELETE',
            body: JSON.stringify({ ids: selectedIds })
        });
        
        // Show success message
        showNotification(
            `Successfully deleted ${result.deletedCount} video${result.deletedCount !== 1 ? 's' : ''}`,
            'success'
        );
        
        // Reset selection and reload data
        if (multiSelectManager) {
            multiSelectManager.reset();
        }
        
        // Reload the table data
        await loadAllEntries();
        
    } catch (error) {
        console.error('Bulk delete failed:', error);
        showNotification(
            `Failed to delete videos: ${error.message}`,
            'error'
        );
    } finally {
        // Clear loading state
        if (bulkActionBar) {
            bulkActionBar.setLoading(false);
        }
    }
}

/**
 * Handle clear selection operation
 */
function handleClearSelection() {
    if (multiSelectManager) {
        multiSelectManager.reset();
    }
    
    console.log('[Multi-Select] Selection cleared');
}

/**
 * Update visual state of selected rows
 * @param {number[]} selectedIds - Array of selected row IDs
 */
function updateRowSelectionVisuals(selectedIds) {
    // Remove selected class from all rows
    const allRows = document.querySelectorAll('#all-table-body tr');
    allRows.forEach(row => row.classList.remove('selected'));
    
    // Add selected class to selected rows
    selectedIds.forEach(id => {
        const checkbox = document.querySelector(`.row-checkbox[value="${id}"]`);
        if (checkbox) {
            const row = checkbox.closest('tr');
            if (row) {
                row.classList.add('selected');
            }
        }
    });
}

async function loadAllEntries() {
    try {
        allEntriesData = await ApiService.request('/api/videos/all/entries');
        initializeMultiSelectComponents();
        renderAllEntriesTable(allEntriesData);
        setupAllViewSearch();
    } catch (error) {
        console.error('Failed to load all entries:', error);
        document.getElementById('all-table-body').innerHTML = '<tr><td colspan="100%" class="error-message">Failed to load data. Please try again.</td></tr>';
    }
}

function renderAllEntriesTable(data) {
    const headerContainer = document.getElementById('all-table-header');
    const bodyContainer = document.getElementById('all-table-body');
    
    // Update view count for All view
    updateViewCount('all', data.length);
    
    if (data.length === 0) {
        headerContainer.innerHTML = '';
        bodyContainer.innerHTML = '<tr><td colspan="100%" class="empty-state">No entries found</td></tr>';
        if (multiSelectManager) {
            multiSelectManager.updateTotalItems(0);
        }
        return;
    }
    
    // Define column order and display names - ALL database columns
    const columns = [
        { key: 'checkbox', label: '', sortable: false, isCheckbox: true },
        { key: 'id', label: 'ID', sortable: true },
        { key: 'person_id', label: 'Person ID', sortable: true },
        { key: 'added_by_name', label: 'Person Name', sortable: true },
        { key: 'link', label: 'Video Link', sortable: false },
        { key: 'type', label: 'Type', sortable: true },
        { key: 'status_1', label: 'Status 1', sortable: true },
        { key: 'status_2', label: 'Status 2', sortable: true },
        { key: 'likes_count', label: 'Likes Count', sortable: true },
        { key: 'relevance_rating', label: 'Relevance Rating', sortable: true },
        { key: 'score', label: 'Score', sortable: true },
        { key: 'video_id_text', label: 'Video ID 1', sortable: true },
        { key: 'video_id_text_2', label: 'Video ID 2', sortable: true },
        { key: 'video_code', label: 'Video Code', sortable: true },
        { key: 'pitch', label: 'Pitch', sortable: true },
        { key: 'note', label: 'Note 1', sortable: true },
        { key: 'note_2', label: 'Note 2', sortable: true },
        { key: 'created_at', label: 'Created At', sortable: true },
        { key: 'updated_at', label: 'Updated At', sortable: true }
    ];
    
    // Render header with checkbox support
    headerContainer.innerHTML = columns.map(col => {
        if (col.isCheckbox) {
            return checkboxColumn ? checkboxColumn.renderHeader() : '<th class="checkbox-column-header"></th>';
        }
        return `
            <th class="${col.sortable ? 'sortable' : ''} ${currentSortColumn === col.key ? 'sort-' + currentSortDirection : ''}" 
                ${col.sortable ? `onclick="sortAllEntries('${col.key}')"` : ''}>
                ${col.label}
            </th>
        `;
    }).join('');
    
    // Render body with checkbox support
    bodyContainer.innerHTML = data.map(entry => {
        const checkboxCell = checkboxColumn ? checkboxColumn.renderRow(entry.id) : '<td class="checkbox-column-cell"></td>';
        
        return `
            <tr>
                ${checkboxCell}
                <td>${entry.id || ''}</td>
                <td>${entry.person_id || ''}</td>
                <td>${escapeHtml(entry.added_by_name || '')}</td>
                <td class="link-cell">
                    ${entry.link ? `<a href="${escapeHtml(entry.link)}" target="_blank" title="${escapeHtml(entry.link)}">${escapeHtml(entry.link)}</a>` : ''}
                </td>
                <td class="type-cell">${entry.type || ''}</td>
                <td class="status-cell">${entry.status_1 || ''}</td>
                <td class="status-cell">${entry.status_2 || ''}</td>
                <td>${entry.likes_count || 0}</td>
                <td>${entry.relevance_rating !== null ? entry.relevance_rating : ''}</td>
                <td>${entry.score !== null ? entry.score.toFixed(2) : ''}</td>
                <td>${escapeHtml(entry.video_id_text || '')}</td>
                <td>${escapeHtml(entry.video_id_text_2 || '')}</td>
                <td>${escapeHtml(entry.video_code || '')}</td>
                <td class="note-cell">${entry.note ? renderNoteDisplay(entry.note, entry.id) : ''}</td>
                <td class="note-cell">${entry.note_2 ? renderNoteDisplay(entry.note_2, entry.id) : ''}</td>
                <td>${entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ''}</td>
                <td>${entry.updated_at ? new Date(entry.updated_at).toLocaleDateString() : ''}</td>
            </tr>
        `;
    }).join('');
    
    // Update multi-select manager with new data
    if (multiSelectManager) {
        multiSelectManager.updateTotalItems(data.length);
    }
    
    console.log(`[Multi-Select] Rendered table with ${data.length} entries and checkboxes`);
}

function sortAllEntries(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    // Get the current filtered data or all data
    const searchInput = document.getElementById('all-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    let dataToSort = allEntriesData;
    if (searchTerm) {
        dataToSort = allEntriesData.filter(entry => {
            return Object.values(entry).some(value => {
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(searchTerm);
            });
        });
    }
    
    const sortedData = [...dataToSort].sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        // Handle null/undefined values
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        
        // Convert to appropriate types for comparison
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    renderAllEntriesTable(sortedData);
}

function setupAllViewSearch() {
    const searchInput = document.getElementById('all-search');
    let searchTimeout;

    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterAllEntries(this.value.toLowerCase());
        }, 300);
    });
}

function filterAllEntries(searchTerm) {
    if (!searchTerm) {
        renderAllEntriesTable(allEntriesData);
        return;
    }
    
    const filteredData = allEntriesData.filter(entry => {
        return Object.values(entry).some(value => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(searchTerm);
        });
    });
    
    // Update count to show filtered results
    updateViewCount('all', filteredData.length);
    
    const headerContainer = document.getElementById('all-table-header');
    const bodyContainer = document.getElementById('all-table-body');
    
    if (filteredData.length === 0) {
        headerContainer.innerHTML = '';
        bodyContainer.innerHTML = '<tr><td colspan="100%" class="empty-state">No entries match your search</td></tr>';
        return;
    }
    
    // Define column order and display names (same as renderAllEntriesTable)
    const columns = [
        { key: 'id', label: 'ID', sortable: true },
        { key: 'added_by_name', label: 'Person', sortable: true },
        { key: 'link', label: 'Video Link', sortable: false },
        { key: 'type', label: 'Type', sortable: true },
        { key: 'status', label: 'Status', sortable: true },
        { key: 'likes_count', label: 'Likes', sortable: true },
        { key: 'relevance_rating', label: 'Relevance', sortable: true },
        { key: 'score', label: 'Score', sortable: true },
        { key: 'video_id_text', label: 'Video ID', sortable: true },
        { key: 'video_code', label: 'Code', sortable: true },
        { key: 'created_at', label: 'Created', sortable: true }
    ];
    
    // Render header
    headerContainer.innerHTML = columns.map(col => `
        <th class="${col.sortable ? 'sortable' : ''} ${currentSortColumn === col.key ? 'sort-' + currentSortDirection : ''}" 
            ${col.sortable ? `onclick="sortAllEntries('${col.key}')"` : ''}>
            ${col.label}
        </th>
    `).join('');
    
    // Render body
    bodyContainer.innerHTML = filteredData.map(entry => `
        <tr>
            <td>${entry.id || ''}</td>
            <td>${escapeHtml(entry.added_by_name || '')}</td>
            <td class="link-cell">
                ${entry.link ? `<a href="${escapeHtml(entry.link)}" target="_blank" title="${escapeHtml(entry.link)}">${escapeHtml(entry.link)}</a>` : ''}
            </td>
            <td class="type-cell">${entry.type || ''}</td>
            <td class="status-cell">${entry.status || ''}</td>
            <td>${entry.likes_count || 0}</td>
            <td>${entry.relevance_rating !== null ? entry.relevance_rating : ''}</td>
            <td>${entry.score !== null ? entry.score.toFixed(2) : ''}</td>
            <td>${escapeHtml(entry.video_id_text || '')}</td>
            <td>${escapeHtml(entry.video_code || '')}</td>
            <td class="note-cell">${entry.note ? renderNoteDisplay(entry.note, entry.id) : ''}</td>
            <td>${entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ''}</td>
        </tr>
    `).join('');
}
// Note Management Functions
let currentNoteVideoId = null;
let currentNoteAction = null;

// Refactored note modal functions using unified Modal component
function showNoteModal(videoId, action, existingNote = '') {
    currentNoteVideoId = videoId;
    currentNoteAction = action;
    
    // Determine modal title based on action
    let title;
    if (action === 'accept') {
        title = 'Add Note - Accepting Video';
    } else if (action === 'reject') {
        title = 'Add Note - Rejecting Video';
    } else {
        title = 'Edit Note';
    }
    
    // Show/hide delete button based on existing note
    const deleteBtn = document.getElementById('noteDeleteBtn');
    if (deleteBtn) {
        deleteBtn.style.display = existingNote ? 'block' : 'none';
    }
    
    // Use unified modal system
    if (noteModal) {
        noteModal.show({ title, content: existingNote });
    } else {
        // Fallback for immediate calls before DOM ready
        Modal.note(videoId, action, existingNote);
    }
}

function hideNoteModal() {
    if (noteModal) {
        noteModal.hide();
    } else {
        // Fallback direct DOM manipulation
        const modal = document.getElementById('noteModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // Clear note modal state
    const textarea = document.getElementById('noteTextarea');
    if (textarea) {
        textarea.value = '';
    }
    currentNoteVideoId = null;
    currentNoteAction = null;
}

async function saveNote() {
    const textarea = document.getElementById('noteTextarea');
    const note = textarea.value.trim();
    
    try {
        if (currentNoteAction === 'accept' || currentNoteAction === 'reject') {
            // Accept or reject with note
            const status = currentNoteAction === 'accept' ? 'accepted' : 'rejected';
            // Use unified generic endpoint
            const hostId = getHostFromTab(currentTab);
            const endpoint = getHostStatusEndpoint(currentNoteVideoId, hostId);
            
            await ApiService.request(endpoint, {
                method: 'PUT',
                body: JSON.stringify({ status, note })
            });
            
            hideNoteModal();
            loadVideos(currentTab);
            updateButtonCounts(); // Update navigation counts
            showNotification(`Video ${currentNoteAction}ed with note successfully!`, 'success');
        } else {
            // Edit existing note - use unified generic endpoint
            const hostId = getHostFromTab(currentTab);
            const endpoint = getHostStatusEndpoint(currentNoteVideoId, hostId);
            
            await ApiService.request(endpoint, {
                method: 'PUT',
                body: JSON.stringify({ note })
            });
            
            hideNoteModal();
            if (currentTab === 'all') {
                loadAllEntries();
            } else {
                loadVideos(currentTab);
            }
            showNotification('Note updated successfully!', 'success');
        }
    } catch (error) {
        console.error('Failed to save note:', error);
        showNotification('Failed to save note. Please try again.', 'error');
    }
}

async function deleteNote() {
    try {
        // Use unified generic endpoint
        const hostId = getHostFromTab(currentTab);
        const endpoint = getHostStatusEndpoint(currentNoteVideoId, hostId);
        
        await ApiService.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify({ note: null })
        });
        
        hideNoteModal();
        if (currentTab === 'all') {
            loadAllEntries();
        } else {
            loadVideos(currentTab);
        }
        showNotification('Note deleted successfully!', 'success');
    } catch (error) {
        console.error('Failed to delete note:', error);
        showNotification('Failed to delete note. Please try again.', 'error');
    }
}

function renderNoteDisplay(note, videoId) {
    const escapedNote = note ? escapeHtml(note).replace(/'/g, "\\'") : '';
    const hasNote = note && note.trim() !== '';
    const action = hasNote ? 'edit' : 'add';
    const title = hasNote ? 'Edit note' : 'Add note';
    const icon = hasNote ? '✏️' : '❓';
    
    return `
        <span class="note-display">
            <button class="note-edit-btn" onclick="showNoteModal(${videoId}, '${action}', '${escapedNote}')" title="${title}">
                ${icon}
            </button>
        </span>
    `;
}

function renderPitchDisplay(pitch, videoId) {
    if (!pitch || pitch.trim() === '') {
        return '<span class="pitch-empty"></span>'; // Blank space for alignment
    }
    
    return `
        <span class="pitch-icon-btn" onclick="showPitchModal(${videoId}, '${escapeHtml(pitch).replace(/'/g, "\\'")}')" style="cursor: pointer; font-size: 16px;" title="View pitch">
            📄
        </span>
    `;
}

// ===== UNIFIED MODAL FUNCTIONS =====
// All modal functions now use the unified Modal class

function showPitchModal(videoId, pitchText) {
    return Modal.pitch(videoId, pitchText);
}

function closePitchModal() {
    const modal = document.getElementById('pitchModal');
    if (modal) {
        const pitchModal = new Modal('pitchModal');
        pitchModal.hide();
    }
}

// Note: Event listeners are now handled by the Modal class automatically

// Function to specifically update the relevance and trash counts
async function updateRelevanceCount() {
    try {
        // Fetch relevance count from the API
        const relevanceResponse = await ApiService.request('/api/videos/system/relevance');
        
        // Update the count in the UI for relevance section
        if (relevanceResponse && typeof relevanceResponse.count === 'number') {
            const relevanceCount = relevanceResponse.count;
            
            // Update relevance button count
            const relevanceButtonCountEl = document.getElementById('relevance-btn-count');
            if (relevanceButtonCountEl) {
                relevanceButtonCountEl.textContent = relevanceCount;
                if (relevanceCount > 0) {
                    relevanceButtonCountEl.style.display = 'inline';
                } else {
                    relevanceButtonCountEl.style.display = 'none';
                }
            }
            
            // Update relevance view count header if applicable
            const relevanceViewCountEl = document.getElementById('relevance-view-count');
            if (relevanceViewCountEl) {
                relevanceViewCountEl.textContent = `(${relevanceCount})`;
            }
            
            console.log('Relevance count updated successfully:', relevanceCount);
        }
        
        // Also fetch and update trash count
        const trashResponse = await ApiService.request('/api/videos/system/trash');
        
        if (trashResponse && typeof trashResponse.count === 'number') {
            const trashCount = trashResponse.count;
            
            // Update trash button count if it exists
            const trashButtonCountEl = document.getElementById('trash-btn-count');
            if (trashButtonCountEl) {
                trashButtonCountEl.textContent = trashCount;
                if (trashCount > 0) {
                    trashButtonCountEl.style.display = 'inline';
                } else {
                    trashButtonCountEl.style.display = 'none';
                }
            }
            
            // Update trash view count header if applicable
            const trashViewCountEl = document.getElementById('trash-view-count');
            if (trashViewCountEl) {
                trashViewCountEl.textContent = `(${trashCount})`;
            }
            
            console.log('Trash count updated successfully:', trashCount);
        }
    } catch (error) {
        console.error('Failed to update relevance/trash counts:', error);
    }
}

// Update button counts in navigation - simplified and faster
async function updateButtonCounts() {
    try {
        console.log('Attempting to fetch button counts...');
        
        // Single API call to get all counts at once
        const counts = await ApiService.getVideoCounts();
        console.log('Counts API response received successfully');
        console.log('Button counts received:', counts);
        
        // Update button counts dynamically for all hosts
        const updates = [
            // All videos count
            { id: 'all-btn-count', count: counts.all || 0 }
        ];
        
        // Dynamically add counts for all hosts using consistent format
        Object.keys(counts).forEach(countKey => {
            // Skip non-host counts
            if (countKey === 'all') {
                return;
            }
            
            // Parse host-specific count keys (new consistent format: 'host1_pending', 'host2_accepted', etc.)
            const hostMatch = countKey.match(/^host(\d+)_(.+)$/);
            if (hostMatch) {
                const hostId = hostMatch[1];
                const status = hostMatch[2];
                
                // Generate the corresponding button ID using fully dynamic format
                const config = getHostConfig(parseInt(hostId));
                let buttonId;
                if (config && config.prefix) {
                    // Use host prefix for button ID
                    buttonId = `${config.prefix}${status}-btn-count`;
                } else {
                    // No prefix (like Host 1)
                    buttonId = `${status}-btn-count`;
                }
                
                updates.push({
                    id: buttonId,
                    count: counts[countKey] || 0
                });
            }
        });
        
        let successCount = 0;
        updates.forEach(({ id, count }) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = `(${count})`;
                element.style.display = 'inline-block';
                console.log(`Updated ${id} with count: ${count}`);
                successCount++;
            } else {
                console.warn(`Element not found: ${id}`);
            }
        });
        
        console.log(`Successfully updated ${successCount}/${updates.length} button counts`);
        
    } catch (error) {
        console.error('Error updating button counts:', error);
        // Fallback to individual calls if needed
        updateButtonCountsFallback();
    }
}

// Fallback function for button counts (simplified)
async function updateButtonCountsFallback() {
    try {
        // Only update counts that are visible and needed
        const quickUpdates = [
            { id: 'pending-btn-count', endpoint: '/api/videos/pending' },
            { id: 'accepted-btn-count', endpoint: '/api/videos/accepted' }
        ];
        
        for (const { id, endpoint } of quickUpdates) {
            const element = document.getElementById(id);
            if (element) {
                try {
                    const data = await ApiService.get(endpoint);
                    element.textContent = `(${data.length})`;
                    element.style.display = 'inline-block';
                } catch (err) {
                    console.warn(`Failed to update ${id}:`, err);
                }
            }
        }
    } catch (error) {
        console.error('Fallback button counts failed:', error);
    }
}

// Tags Management Functions

// Load all tags from the server
async function loadTags() {
    try {
        tags = await ApiService.request('/api/tags');
        if (currentTab === 'manage-tags') {
            renderTagsList();
        }
    } catch (error) {
        console.error('Failed to load tags:', error);
        tags = [];
    }
}

// Render the tags list in the manage tags section
function renderTagsList() {
    const container = document.getElementById('tags-list');
    if (!container) return;
    
    if (tags.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No tags created yet. Add your first tag above.</p></div>';
        return;
    }
    
    container.innerHTML = tags.map(tag => `
        <div class="tag-item">
            <div class="tag-display">
                <span class="tag-preview" style="background-color: ${tag.color}">${tag.name}</span>
                <span class="tag-name">${tag.name}</span>
            </div>
            <div class="tag-actions">
                <button class="btn btn-secondary" onclick="editTag(${tag.id}, '${escapeHtml(tag.name)}', '${tag.color}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteTag(${tag.id}, '${escapeHtml(tag.name)}')">Delete</button>
            </div>
        </div>
    `).join('');
}

// Add new tag
async function addTag(name, color) {
    try {
        const newTag = await ApiService.request('/api/tags', {
            method: 'POST',
            body: JSON.stringify({ name, color })
        });
        
        tags.push(newTag);
        renderTagsList();
        showSuccessNotification('Tag added successfully!');
        return true;
    } catch (error) {
        console.error('Failed to add tag:', error);
        if (error.message.includes('already exists')) {
            alert('A tag with this name already exists.');
        } else {
            alert('Failed to add tag. Please try again.');
        }
        return false;
    }
}

// Edit existing tag
async function editTag(tagId, currentName, currentColor) {
    const newName = prompt('Enter new tag name:', currentName);
    if (!newName || newName.trim() === '') return;
    
    const newColor = prompt('Enter new color (hex format):', currentColor);
    if (!newColor) return;
    
    try {
        const updatedTag = await ApiService.request(`/api/tags/${tagId}`, {
            method: 'PUT',
            body: JSON.stringify({ name: newName.trim(), color: newColor })
        });
        
        const tagIndex = tags.findIndex(t => t.id === tagId);
        if (tagIndex !== -1) {
            tags[tagIndex] = updatedTag;
        }
        
        renderTagsList();
        showSuccessNotification('Tag updated successfully!');
    } catch (error) {
        console.error('Failed to update tag:', error);
        if (error.message.includes('already exists')) {
            alert('A tag with this name already exists.');
        } else {
            alert('Failed to update tag. Please try again.');
        }
    }
}

// Delete tag
async function deleteTag(tagId, tagName) {
    if (!confirm(`Are you sure you want to delete the tag "${tagName}"? This will remove it from all videos.`)) {
        return;
    }
    
    try {
        await ApiService.request(`/api/tags/${tagId}`, {
            method: 'DELETE'
        });
        
        tags = tags.filter(t => t.id !== tagId);
        renderTagsList();
        showSuccessNotification('Tag deleted successfully!');
    } catch (error) {
        console.error('Failed to delete tag:', error);
        alert('Failed to delete tag. Please try again.');
    }
}

// Setup tag modal functionality
function setupTagModal() {
    const modal = document.getElementById('tagSelectionModal');
    const closeBtn = document.getElementById('tagModalClose');
    const cancelBtn = document.getElementById('tagModalCancel');
    const saveBtn = document.getElementById('tagModalSave');
    
    if (!modal || !closeBtn || !cancelBtn || !saveBtn) {
        console.warn('Tag modal elements not found');
        return;
    }
    
    // Close modal handlers
    closeBtn.addEventListener('click', hideTagModal);
    cancelBtn.addEventListener('click', hideTagModal);
    
    // Save tags handler
    saveBtn.addEventListener('click', saveVideoTags);
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            hideTagModal();
        }
    });
}

// Show tag selection modal for a video
async function showTagModal(videoId) {
    currentVideoId = videoId;
    
    try {
        // Load current video tags
        const videoTags = await ApiService.request(`/api/videos/${videoId}/tags`);
        const videoTagIds = videoTags.map(tag => tag.id);
        
        // Use unified modal system
        return Modal.tags(videoId, tags, videoTagIds, saveVideoTags);
    } catch (error) {
        console.error('Failed to load video tags:', error);
        Modal.message('Failed to load tags. Please try again.', 'error');
    }
}

// Hide tag selection modal
function hideTagModal() {
    const modal = document.getElementById('tagSelectionModal');
    if (modal) {
        const tagModal = new Modal('tagSelectionModal');
        tagModal.hide();
    }
    currentVideoId = null;
}

// Save selected tags for the current video
async function saveVideoTags() {
    if (!currentVideoId) return;
    
    const checkboxes = document.querySelectorAll('#tagSelectionList input[type="checkbox"]');
    const selectedTagIds = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));
    
    try {
        await ApiService.request(`/api/videos/${currentVideoId}/tags`, {
            method: 'PUT',
            body: JSON.stringify({ tag_ids: selectedTagIds })
        });
        
        hideTagModal();
        loadVideos(currentTab); // Refresh current view
        showSuccessNotification('Tags updated successfully!');
    } catch (error) {
        console.error('Failed to save video tags:', error);
        alert('Failed to save tags. Please try again.');
    }
}

// Render tags display for a video (used in video cards)
function renderVideoTags(videoTags) {
    if (!videoTags || videoTags.length === 0) {
        return '<span class="tags-placeholder">#</span>';
    }
    
    return videoTags.map(tag => 
        `<span class="video-tag" style="background-color: ${tag.color}">${tag.name}</span>`
    ).join('');
}

// Load tags for a specific video (used when rendering video cards)
async function loadVideoTags(videoId) {
    try {
        return await ApiService.request(`/api/videos/${videoId}/tags`);
    } catch (error) {
        console.error('Failed to load video tags:', error);
        return [];
    }
}

// Initialize note modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    const noteSaveBtn = document.getElementById('noteSaveBtn');
    const noteDeleteBtn = document.getElementById('noteDeleteBtn');
    const noteCancelBtn = document.getElementById('noteCancelBtn');
    const noteModal = document.getElementById('noteModal');
    
    if (noteSaveBtn) {
        noteSaveBtn.addEventListener('click', saveNote);
    }
    
    if (noteDeleteBtn) {
        noteDeleteBtn.addEventListener('click', deleteNote);
    }
    
    if (noteCancelBtn) {
        noteCancelBtn.addEventListener('click', hideNoteModal);
    }
    
    // Close modal when clicking outside
    if (noteModal) {
        noteModal.addEventListener('click', function(e) {
            if (e.target === noteModal) {
                hideNoteModal();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && noteModal.style.display === 'flex') {
            hideNoteModal();
        }
    });
});

// Copy to clipboard functionality
async function copyLinkAndNote(videoLink, videoNote) {
    try {
        // Create tab-separated format for Google Sheets (link + tab + note)
        const textToCopy = `${videoLink || ''}\t${videoNote || ''}`;
        
        // Use the modern Clipboard API
        await navigator.clipboard.writeText(textToCopy);
        
        // Show visual feedback
        showCopySuccess();
        showNotification('Link and note copied to clipboard!', 'success');
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        
        // Fallback for older browsers
        try {
            const textArea = document.createElement('textarea');
            textArea.value = `${videoLink || ''}\t${videoNote || ''}`;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            showCopySuccess();
            showNotification('Link and note copied to clipboard!', 'success');
        } catch (fallbackError) {
            console.error('Fallback copy failed:', fallbackError);
            showNotification('Failed to copy to clipboard. Please copy manually.', 'error');
        }
    }
}

function showCopySuccess() {
    // Find all copy buttons and briefly highlight them
    const copyBtns = document.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
        btn.classList.add('copy-success');
        setTimeout(() => {
            btn.classList.remove('copy-success');
        }, 300);
    });
}

// ===== HOST MANAGEMENT FUNCTIONS =====

// Load hosts when manage-hosts tab is opened
async function loadHosts() {
    const hostsContainer = document.getElementById('hosts-container');
    if (!hostsContainer) return;
    
    try {
        // Show loading state
        hostsContainer.innerHTML = '<div class="loading">Loading hosts...</div>';
        
        // Fetch hosts from database
        const hosts = await ApiService.getHosts();
        console.log('[Phase 4.3] Loaded hosts for management:', hosts);
        
        // Clear container
        hostsContainer.innerHTML = '';
        
        // Display hosts from database
        hosts.forEach(host => {
            const hostElement = document.createElement('div');
            hostElement.className = 'host-item';
            hostElement.innerHTML = `
                <div class="host-info">
                    <span class="host-id">Host ${host.host_id}</span>
                    <span class="host-name">${host.name}</span>
                    <span class="host-details">(${host.prefix || 'default'} | ${host.status_column})</span>
                </div>
                <div class="host-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editHost(${host.host_id}, '${host.name}')">Edit</button>
                    ${host.host_id > 1 ? `<button class="btn btn-sm btn-danger" onclick="deleteHost(${host.host_id})">Delete</button>` : ''}
                </div>
            `;
            hostsContainer.appendChild(hostElement);
        });
        
        if (hosts.length === 0) {
            hostsContainer.innerHTML = '<div class="no-hosts">No hosts found</div>';
        }
        
    } catch (error) {
        console.error('[Phase 4.3] Error loading hosts:', error);
        hostsContainer.innerHTML = `<div class="error">Error loading hosts: ${error.message}</div>`;
    }
}

// Add new host
async function addHost(hostName) {
    console.log('[Phase 4.3] addHost called with:', hostName);
    
    if (!hostName || !hostName.trim()) {
        showNotification('Host name is required', 'error');
        return;
    }
    
    try {
        // Get ALL hosts (including inactive) to determine next available ID
        const allHosts = await ApiService.get('/api/hosts?include_inactive=true');
        const allIds = allHosts.map(host => host.host_id);
        const nextId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
        
        console.log('[Phase 4.3] Adding host with ID:', nextId);
        
        // Create new host object
        const newHost = {
            host_id: nextId,
            name: hostName.trim(),
            prefix: nextId === 1 ? '' : `host${nextId}-`,
            status_column: nextId === 1 ? 'status_1' : `status_${nextId}`,
            note_column: nextId === 1 ? 'note' : `note_${nextId}`,
            video_id_column: nextId === 1 ? 'video_id_text' : `video_id_text_${nextId}`,
            api_path: nextId === 1 ? '' : `host${nextId}`,
            count_prefix: nextId === 1 ? '' : `person${nextId}_`
        };
        
        // Send POST request to create host
        const createdHost = await ApiService.post('/api/hosts', {
            host_id: nextId,
            name: hostName.trim()
        });
        console.log('[Phase 4.3] Host created successfully:', createdHost);
        
        showNotification(`Host "${hostName}" added successfully!`, 'success');
        
        // Clear form
        const hostNameInput = document.getElementById('host-name');
        if (hostNameInput) {
            hostNameInput.value = '';
        }
        
        // Reload hosts display
        await loadHosts();
        
        // Update navigation with new host
        await updateNavigation();
        
    } catch (error) {
        console.error('[Phase 4.3] Failed to add host:', error);
        showNotification('Failed to add host: ' + error.message, 'error');
    }
}

// Edit host name
async function editHost(hostId, currentName) {
    const newName = prompt(`Edit host name:`, currentName);
    if (newName && newName !== currentName && newName.trim()) {
        try {
            console.log(`[Phase 4.3] Editing host ${hostId} name to:`, newName);
            
            // First, get the current host data to preserve all fields
            const hosts = await ApiService.getHosts();
            const currentHost = hosts.find(h => h.host_id === hostId);
            
            if (!currentHost) {
                throw new Error('Host not found');
            }
            
            // Send PUT request with all required fields
            const updateData = {
                name: newName.trim(),
                prefix: currentHost.prefix,
                status_column: currentHost.status_column,
                note_column: currentHost.note_column,
                video_id_column: currentHost.video_id_column,
                api_path: currentHost.api_path,
                count_prefix: currentHost.count_prefix
            };
            const updatedHost = await ApiService.put(`/api/hosts/${hostId}`, updateData);
            console.log('[Phase 4.3] Host updated successfully:', updatedHost);
            
            showNotification(`Host ${hostId} renamed to "${newName}" successfully!`, 'success');
            
            // Reload hosts display
            await loadHosts();
            
            // Reload host configuration and update navigation
            await loadHostConfiguration();
            await updateNavigation();
            
        } catch (error) {
            console.error('[Phase 4.3] Failed to edit host:', error);
            showNotification('Failed to edit host: ' + error.message, 'error');
        }
    }
}

// Delete host
async function deleteHost(hostId) {
    try {
        // Get host details first
        const hosts = await ApiService.getHosts();
        const host = hosts.find(h => h.host_id === hostId);
        const hostName = host?.name || `Host ${hostId}`;
        
        // No hardcoded host deletion protection - system is fully dynamic
        // Host deletion protection should be handled by business logic, not hardcoded host IDs
        
        if (confirm(`Are you sure you want to delete ${hostName}? This will remove the host from the system permanently.`)) {
            console.log(`[Phase 4.3] Deleting host ${hostId}:`, hostName);
            
            // Send DELETE request
            const result = await ApiService.delete(`/api/hosts/${hostId}`);
            
            console.log('[Phase 4.3] Host deleted successfully');
            
            showNotification(`${hostName} deleted successfully!`, 'success');
            
            // Reload hosts display
            await loadHosts();
            
            // Reload host configuration and update navigation
            await loadHostConfiguration();
            await updateNavigation();
        }
        
    } catch (error) {
        console.error('[Phase 4.3] Failed to delete host:', error);
        showNotification('Failed to delete host: ' + error.message, 'error');
    }
}

// Initialize host management - handle both cases: DOM already loaded or still loading
function initializeHostManagement() {
    // Add form submission handler for add host form
    const addHostForm = document.getElementById('add-host-form');
    if (addHostForm) {
        // Remove any existing event listeners to avoid duplicates
        addHostForm.removeEventListener('submit', handleAddHostSubmit);
        addHostForm.addEventListener('submit', handleAddHostSubmit);
        console.log('Host management form handler attached');
    } else {
        console.log('Add host form not found');
    }
}

// Handle add host form submission - refactored with FormValidator
function handleAddHostSubmit(e) {
    e.preventDefault();
    console.log('Add host form submitted');
    
    // Create validator for the host form
    const validator = new FormValidator(e.target)
        .required('host-name', 'Please enter a host name')
        .minLength('host-name', 2, 'Host name must be at least 2 characters');
    
    if (validator.validate()) {
        const data = validator.getData();
        addHost(data['host-name']);
    } else {
        validator.showErrorAlert();
    }
}

// Initialize when DOM is loaded OR immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHostManagement);
} else {
    initializeHostManagement();
}

// Update navigation dropdowns with current host names
// Create content containers for new hosts that don't have them yet
async function createHostContentContainers() {
    try {
        console.log('[Phase 4.3] Creating content containers for new hosts...');
        
        // Get the main app container where content divs should be added
        const mainApp = document.getElementById('main-app');
        if (!mainApp) {
            console.error('Main app container not found');
            return;
        }
        
        // Get all active hosts
        const hosts = await ApiService.request('/api/hosts');
        const statusTypes = ['pending', 'accepted', 'rejected', 'assigned'];
        
        hosts.forEach(host => {
            const hostId = host.host_id;
            
            // Skip hosts that use regular tab IDs without host prefix
            const config = getHostConfig(hostId);
            if (!config || !config.prefix) return;
            
            statusTypes.forEach(status => {
                const tabId = `host${hostId}-${status}`;
                
                // Check if content container already exists
                if (!document.getElementById(tabId)) {
                    console.log(`Creating content container for ${tabId}`);
                    
                    // Create the content container
                    const contentDiv = document.createElement('div');
                    contentDiv.id = tabId;
                    contentDiv.className = 'tab-content';
                    
                    // Add the content structure (consistent with Host 1 and Host 2 - no description messages)
                    contentDiv.innerHTML = `
                        <div class="view-header">
                            <h2>${getStatusIcon(status)} ${host.name} - ${capitalizeFirst(status)} <span id="${tabId}-count" class="view-count"></span></h2>
                        </div>
                        <div id="${tabId}-videos" class="videos-container">
                            <!-- Videos will be loaded here -->
                        </div>
                    `;
                    
                    // Append to main app
                    mainApp.appendChild(contentDiv);
                }
            });
        });
        
        console.log('[Phase 4.3] Content containers created successfully');
    } catch (error) {
        console.error('[Phase 4.3] Error creating content containers:', error);
    }
}

// Helper functions for content container creation
function getStatusIcon(status) {
    const icons = {
        pending: '⏳',
        accepted: '✅',
        rejected: '❌',
        assigned: '🆔'
    };
    return icons[status] || '📝';
}

function getStatusDescription(status) {
    const descriptions = {
        pending: 'Videos awaiting review',
        accepted: 'Approved videos ready for production',
        rejected: 'Videos that did not meet criteria',
        assigned: 'Videos with assigned IDs'
    };
    return descriptions[status] || 'Video management';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function updateNavigation() {
    try {
        console.log('[Phase 4.3] Starting complete navigation rebuild...');
        
        // Remember current tab before rebuilding
        const currentTabId = currentTab;
        console.log('[Phase 4.3] Current tab before navigation rebuild:', currentTabId);
        
        // Step 1: Reload host configuration first (all hosts and their settings)
        await loadHostConfiguration();
        
        // Step 2: Get the navigation container
        const navContainer = document.querySelector('.tab-nav');
        if (!navContainer) {
            throw new Error('Navigation container not found');
        }
        
        // Step 3: Completely regenerate the navigation HTML
        navContainer.innerHTML = generateNavigationHTML();
        
        // Step 4: Reattach event listeners to all navigation elements
        // Handle regular tab buttons
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                if (tabId) switchTab(tabId);
            });
        });
        
        // Handle dropdown items
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                if (tabId) switchTab(tabId);
                // Close all dropdowns after selection
                document.querySelectorAll('.dropdown').forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            });
        });
        
        // Handle dropdown buttons
        document.querySelectorAll('.dropdown-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const dropdown = this.closest('.dropdown');
                dropdown.classList.toggle('active');
                
                // Close all other dropdowns
                document.querySelectorAll('.dropdown').forEach(otherDropdown => {
                    if (otherDropdown !== dropdown) {
                        otherDropdown.classList.remove('active');
                    }
                });
            });
        });
        
        // Step 5: Create content containers for new hosts
        await createHostContentContainers();
        
        // Step 6: Update the counts
        await updateButtonCounts();
        
        // Step 7: Reload the current view to reflect changes
        if (currentTabId) {
            console.log('[Phase 4.3] Reloading current tab after navigation rebuild:', currentTabId);
            
            // Ensure the content container exists before switching
            const targetContent = document.getElementById(currentTabId);
            if (targetContent) {
                // Content container exists, safe to switch
                switchTab(currentTabId);
            } else {
                console.log(`[Phase 4.3] Content container for ${currentTabId} not found, will be created on demand`);
                // Don't call switchTab here - it will be handled when user clicks the tab
            }
        }
        
        console.log('[Phase 4.3] Navigation fully rebuilt after host changes');
    } catch (error) {
        console.error('[Phase 4.3] Failed to rebuild navigation:', error);
    }
}

// Add to switchTab function to load hosts when manage-hosts tab is opened
const originalSwitchTab = switchTab;
if (typeof switchTab === 'function') {
    switchTab = function(tabId) {
        originalSwitchTab(tabId);
        if (tabId === 'manage-hosts') {
            // Ensure host management is initialized when tab is opened
            setTimeout(() => {
                initializeHostManagement();
                loadHosts();
            }, 100); // Small delay to ensure DOM elements are visible
        }
    };
}
