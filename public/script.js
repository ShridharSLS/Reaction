// Global state
let currentTab = 'pending';
let people = [];
let tags = [];
let confirmationCallback = null;
let videoIdCallback = null;
let tagSelectionCallback = null;
let currentVideoId = null;

// Host Configuration System (Phase 1: Foundation)
// This defines the mapping for each host's database columns and UI patterns
const HOST_CONFIG = {
    1: {
        id: 1,
        name: 'Shridhar',
        prefix: '',
        statusCol: 'status_1',
        noteCol: 'note',
        videoIdCol: 'video_id_text',
        apiPath: '',
        countPrefix: ''
    },
    2: {
        id: 2,
        name: 'Host 2',
        prefix: 'host2-',
        statusCol: 'status_2',
        noteCol: 'note_2',
        videoIdCol: 'video_id_text_2',
        apiPath: 'host2',
        countPrefix: 'person2_'
    }
};

// Helper function to get host configuration
function getHostConfig(hostId) {
    return HOST_CONFIG[hostId] || null;
}

// Helper function to detect host from tab/status string
function getHostFromStatus(status) {
    if (status.startsWith('host2-')) return 2;
    return 1; // Default to Shridhar
}

// Helper function to get host from tab ID
function getHostFromTab(tabId) {
    if (tabId.startsWith('host2-')) return 2;
    return 1; // Default to Shridhar
}

// Unified Helper Functions (Phase 1.2: Non-Breaking)
// These provide host-agnostic access to data and endpoints

// Get the correct video column value for any host
function getVideoColumn(video, hostId, columnType) {
    const config = getHostConfig(hostId);
    if (!config) return null;
    
    switch(columnType) {
        case 'status': return video[config.statusCol];
        case 'note': return video[config.noteCol];
        case 'videoId': return video[config.videoIdCol];
        default: return null;
    }
}

// Get the correct API endpoint for any host and action
function getHostApiEndpoint(hostId, videoId, action) {
    const config = getHostConfig(hostId);
    if (!config) return null;
    
    if (hostId === 1) {
        // Shridhar uses the original endpoints
        return `/api/videos/${videoId}/status`;
    } else {
        // Other hosts use the host-specific endpoints
        return `/api/videos/${videoId}/${config.apiPath}/status`;
    }
}

// Get the correct count key for any host and status
function getCountKey(hostId, status) {
    const config = getHostConfig(hostId);
    if (!config) return null;
    
    if (hostId === 1) {
        // Shridhar uses the original count keys
        return status; // e.g., 'pending', 'accepted'
    } else {
        // Other hosts use prefixed count keys
        return `${config.countPrefix}${status}`; // e.g., 'person2_pending'
    }
}

// Get the correct tab ID for any host and status
function getTabId(hostId, status) {
    const config = getHostConfig(hostId);
    if (!config) return null;
    
    if (hostId === 1) {
        return status; // e.g., 'pending', 'accepted'
    } else {
        return `${config.prefix}${status}`; // e.g., 'host2-pending'
    }
}

// Get the correct button count element ID for any host and status
function getButtonCountId(hostId, status) {
    const config = getHostConfig(hostId);
    if (!config) return null;
    
    if (hostId === 1) {
        return `${status}-btn-count`; // e.g., 'pending-btn-count'
    } else {
        return `${config.prefix}${status}-btn-count`; // e.g., 'host2-pending-btn-count'
    }
}

// Get the correct view count element ID for any host and status
function getViewCountId(hostId, status) {
    const config = getHostConfig(hostId);
    if (!config) return null;
    
    if (hostId === 1) {
        return `${status}-count`; // e.g., 'pending-count'
    } else {
        return `${config.prefix}${status}-count`; // e.g., 'host2-pending-count'
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

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initializing... currentTab:', currentTab);
    
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
    document.getElementById(tabId).classList.add('active');
    
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
    } else if (tabId !== 'add-topic' && tabId !== 'bulk-import') {
        loadVideos(tabId);
    }
}

// API Functions
async function apiCall(url, options = {}) {
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
            // Create an error with the server's error message
            const error = new Error(data.error || `HTTP error! status: ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
        }
        
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        // Don't show generic alert here - let the calling function handle it
        throw error;
    }
}

// Load People
async function loadPeople() {
    try {
        // Load active people for forms and main list
        people = await apiCall('/api/people');
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
        const archivedPeople = await apiCall('/api/people?archived=true');
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
        console.log(`Loading ${status} videos...`);
        
        // Determine API endpoint based on status
        let apiEndpoint;
        if (status.startsWith('host2-')) {
            // Host 2 tabs: use host2 API endpoint
            const host2Status = status.replace('host2-', '');
            apiEndpoint = `/api/videos/host2/${host2Status}`;
        } else {
            // Regular tabs: use standard API endpoint
            apiEndpoint = `/api/videos/${status}`;
        }
        
        const videos = await apiCall(apiEndpoint);
        console.log(`Received ${videos.length} ${status} videos:`, videos);
        
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
                
                ${status === 'relevance' ? `
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
                
                ${(status.startsWith('host2-') ? video.video_id_text_2 : video.video_id_text) ? `
                    <div class="detail-item">
                        <span class="detail-label">Video ID</span>
                        <span class="detail-value">
                            <input type="text" value="${escapeHtml(status.startsWith('host2-') ? video.video_id_text_2 : video.video_id_text)}" 
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
                        ${renderNoteDisplay(status.startsWith('host2-') ? video.note_2 : video.note, video.id)}
                    </span>
                </div>
            </div>
            
            <div class="video-actions">
                ${getVideoActions(video, status)}
            </div>
        </div>
    `;
}

function getVideoActions(video, status) {
    // Check if this is a Host 2 view
    if (status.startsWith('host2-')) {
        const host2Status = status.replace('host2-', '');
        return getHost2VideoActions(video, host2Status);
    }
    
    // Regular Shridhar views
    switch (status) {
        case 'pending':
            return `
                <button class="btn btn-success" onclick="acceptVideo(${video.id})">Accept</button>
                <button class="btn btn-primary" onclick="assignVideoId(${video.id})">ID given</button>
                <button class="btn btn-reject" onclick="rejectVideo(${video.id})">Reject</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">Delete</button>
            `;
        case 'accepted':
            return `
                <button class="copy-btn" onclick="copyLinkAndNote('${video.link.replace(/'/g, '\\\'')}', '${(video.note || '').replace(/'/g, '\\\'')}')" title="Copy link and note for Google Sheets">
                    📋
                </button>
                <button class="btn btn-primary" onclick="assignVideoId(${video.id})">ID given</button>
                <button class="btn btn-reject" onclick="rejectVideo(${video.id})">Reject</button>
                <button class="btn btn-warning" onclick="revertToPending(${video.id})">Pending</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">Delete</button>
            `;
        case 'rejected':
            return `
                <button class="btn btn-success" onclick="acceptVideo(${video.id})">Accept</button>
                <button class="btn btn-warning" onclick="revertToPending(${video.id})">Pending</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">Delete</button>
            `;
        case 'assigned':
            return `
                <button class="copy-btn" onclick="copyLinkAndNote('${video.link.replace(/'/g, '\\\'')}', '${(video.note || '').replace(/'/g, '\\\'')}')" title="Copy link and note for Google Sheets">
                    📋
                </button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">Delete</button>
            `;

        case 'relevance':
            return `
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">Delete</button>
            `;
        default:
            return '';
    }
}

// Host 2 specific action buttons (only updates status_2)
function getHost2VideoActions(video, status) {
    switch (status) {
        case 'pending':
            return `
                <button class="btn btn-success" onclick="hostAction(2, ${video.id}, 'accept')">Accept</button>
                <button class="btn btn-primary" onclick="host2AssignVideoId(${video.id})">ID given</button>
                <button class="btn btn-reject" onclick="hostAction(2, ${video.id}, 'reject')">Reject</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">Delete</button>
            `;
        case 'accepted':
            return `
                <button class="copy-btn" onclick="copyLinkAndNote('${video.link.replace(/'/g, '\\\'')}', '${(video.note_2 || '').replace(/'/g, '\\\'')}')" title="Copy link and note for Google Sheets">
                    📋
                </button>
                <button class="btn btn-primary" onclick="host2AssignVideoId(${video.id})">ID given</button>
                <button class="btn btn-reject" onclick="hostAction(2, ${video.id}, 'reject')">Reject</button>
                <button class="btn btn-warning" onclick="hostAction(2, ${video.id}, 'pending')">Pending</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">Delete</button>
            `;
        case 'rejected':
            return `
                <button class="btn btn-success" onclick="hostAction(2, ${video.id}, 'accept')">Accept</button>
                <button class="btn btn-warning" onclick="hostAction(2, ${video.id}, 'pending')">Pending</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">Delete</button>
            `;
        case 'assigned':
            return `
                <button class="copy-btn" onclick="copyLinkAndNote('${video.link.replace(/'/g, '\\\'')}', '${(video.note_2 || '').replace(/'/g, '\\\'')}')" title="Copy link and note for Google Sheets">
                    📋
                </button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">Delete</button>
            `;
        default:
            return '';
    }
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
            likes_count: parseInt(document.getElementById('likes-count').value)
        };
        
        try {
            await apiCall('/api/videos', {
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
            await apiCall('/api/people', {
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
        await apiCall(`/api/people/${personId}`, {
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
        
        const response = await fetch(`/api/people/${personId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
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
        await apiCall(`/api/people/${personId}/archive`, {
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
        await apiCall(`/api/people/${personId}/unarchive`, {
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

// Show temporary message to user
function showTemporaryMessage(message, type = 'info') {
    // Create a temporary message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `temp-message temp-message-${type}`;
    messageDiv.textContent = message;
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
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 5000);
}

// Modal Setup
function setupModals() {
    console.log('Setting up modals...');
    
    // Confirmation Modal - with null checks
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');
    const confirmationModal = document.getElementById('confirmation-modal');
    
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
        await apiCall(`/api/videos/${videoId}/relevance`, {
            method: 'PUT',
            body: JSON.stringify({ relevance_rating: parseInt(relevanceRating) })
        });
        
        // Refresh current view
        loadVideos(currentTab);
        
        // If we're in relevance view and rating is 0-3, also refresh pending view
        // since the video may have moved there
        if (currentTab === 'relevance' && relevanceRating >= 0 && relevanceRating <= 3) {
            // Small delay to ensure backend processing is complete
            setTimeout(() => {
                if (currentTab === 'pending') {
                    loadVideos('pending');
                }
            }, 500);
        }
    } catch (error) {
        console.error('Failed to update relevance:', error);
    }
}

async function updateVideoId(videoId, videoIdText) {
    try {
        await apiCall(`/api/videos/${videoId}/status`, {
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
        await apiCall(`/api/videos/${videoId}/status`, {
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

// Host 2 Clear Video ID (only updates status_2 and video_id_text_2)
async function host2ClearVideoId(videoId) {
    try {
        await apiCall(`/api/videos/${videoId}/host2/status`, {
            method: 'PUT',
            body: JSON.stringify({ 
                status: 'accepted',
                video_id_text: null
            })
        });
        
        // Refresh current view
        loadVideos(currentTab);
        updateButtonCounts();
    } catch (error) {
        console.error('Failed to clear Host 2 video ID:', error);
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
    
    if (hostId === 1) {
        // Use existing Shridhar modal system (uses 'accept')
        showNoteModal(videoId, 'accept');
    } else {
        // Use host-specific modal system (uses 'accepted')
        showHost2NoteModal(videoId, 'accepted');
    }
}

// Helper function for reject action
async function hostActionReject(hostId, videoId) {
    const config = getHostConfig(hostId);
    
    if (hostId === 1) {
        // Use existing Shridhar modal system (uses 'reject')
        showNoteModal(videoId, 'reject');
    } else {
        // Use host-specific modal system (uses 'rejected')
        showHost2NoteModal(videoId, 'rejected');
    }
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
            
            await apiCall(endpoint, {
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
        await apiCall(endpoint, {
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
        await apiCall(endpoint, {
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

// Original Action Functions (Preserved for compatibility and testing)

async function acceptVideo(videoId) {
    // Show note modal for accept action
    showNoteModal(videoId, 'accept');
}

async function rejectVideo(videoId) {
    // Show note modal for reject action
    showNoteModal(videoId, 'reject');
}

function assignVideoId(videoId) {
    showVideoIdInput(async (videoIdText) => {
        try {
            await apiCall(`/api/videos/${videoId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    status: 'assigned',
                    video_id_text: videoIdText
                })
            });
            loadVideos(currentTab);
        } catch (error) {
            console.error('Failed to assign video ID:', error);
        }
    });
}



async function revertToPending(videoId) {
    try {
        await apiCall(`/api/videos/${videoId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'pending' })
        });
        loadVideos(currentTab);
        updateButtonCounts(); // Update navigation counts
    } catch (error) {
        console.error('Failed to revert video:', error);
    }
}

async function revertToAccepted(videoId) {
    try {
        await apiCall(`/api/videos/${videoId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'accepted' })
        });
        loadVideos(currentTab);
        updateButtonCounts(); // Update navigation counts
    } catch (error) {
        console.error('Failed to revert video:', error);
    }
}

function deleteVideo(videoId) {
    showConfirmation(
        'Delete Video',
        'Are you sure you want to permanently delete this video? This action cannot be undone.',
        async () => {
            try {
                await apiCall(`/api/videos/${videoId}`, {
                    method: 'DELETE'
                });
                loadVideos(currentTab);
            } catch (error) {
                console.error('Failed to delete video:', error);
            }
        }
    );
}

// Host 2 Action Functions (only update status_2 column)
async function host2AcceptVideo(videoId) {
    // Show note modal for Host 2 accept action
    showHost2NoteModal(videoId, 'accepted');
}

async function host2RejectVideo(videoId) {
    // Show note modal for Host 2 reject action
    showHost2NoteModal(videoId, 'rejected');
}

function host2AssignVideoId(videoId) {
    showVideoIdInput(async (videoIdText) => {
        try {
            await apiCall(`/api/videos/${videoId}/host2/status`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    status: 'assigned',
                    video_id_text: videoIdText
                })
            });
            loadVideos(currentTab);
            updateButtonCounts();
        } catch (error) {
            console.error('Failed to assign Host 2 video ID:', error);
        }
    });
}

async function host2RevertToPending(videoId) {
    try {
        await apiCall(`/api/videos/${videoId}/host2/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'pending' })
        });
        loadVideos(currentTab);
        updateButtonCounts();
    } catch (error) {
        console.error('Failed to revert Host 2 video:', error);
    }
}

// Host 2 Note Modal (for status_2 and note_2)
function showHost2NoteModal(videoId, action) {
    const modal = document.getElementById('noteModal');
    const title = document.getElementById('noteModalTitle');
    const input = document.getElementById('noteTextarea');
    const saveBtn = document.getElementById('noteSaveBtn');
    const cancelBtn = document.getElementById('noteCancelBtn');
    
    title.textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} Video - Add Note (Host 2)`;
    input.value = '';
    modal.style.display = 'block';
    input.focus();
    
    // Remove any existing event listeners
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // Add cancel event listener
    newCancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Add new event listener for Host 2
    newSaveBtn.addEventListener('click', async () => {
        const note = input.value.trim();
        if (!note) {
            alert('Please enter a note.');
            return;
        }
        
        try {
            await apiCall(`/api/videos/${videoId}/host2/status`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    status: action,
                    note: note
                })
            });
            
            modal.style.display = 'none';
            loadVideos(currentTab);
            updateButtonCounts();
        } catch (error) {
            console.error(`Failed to ${action} Host 2 video:`, error);
            alert(`Failed to ${action} video. Please try again.`);
        }
    });
}

// Modal Functions
function showConfirmation(title, message, callback) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('confirmation-modal').style.display = 'block';
    confirmationCallback = callback;
}

function showVideoIdInput(callback) {
    document.getElementById('video-id-modal').style.display = 'block';
    document.getElementById('video-id-input').focus();
    videoIdCallback = callback;
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
            errors.push(`Row ${rowNum}: Expected 4-5 columns (Name, Link, Type, Likes, Relevance), found ${columns.length}`);
            return;
        }
        
        const [name, link, type, likes, relevance] = columns.map(col => col.trim());
        
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
                        <th>Relevance</th>
                        <th>Destination</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        parsedBulkData.forEach(row => {
            const relevanceDisplay = row.relevance !== null ? row.relevance : '-';
            const destination = row.relevance !== null ? '🟡 Pending' : '🎯 Relevance';
            tableHTML += `
                <tr>
                    <td>${row.rowNum}</td>
                    <td>${escapeHtml(row.name)}</td>
                    <td><a href="${escapeHtml(row.link)}" target="_blank">${truncateUrl(row.link, 40)}</a></td>
                    <td>${escapeHtml(row.type)}</td>
                    <td>${row.likes}</td>
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
                    const response = await fetch('/api/people', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ name: row.name })
                    });
                    
                    if (response.ok) {
                        const newPerson = await response.json();
                        person = { id: newPerson.id, name: row.name };
                        people.push(person); // Add to local people array for subsequent rows
                    } else {
                        results.push({
                            row: row.rowNum,
                            status: 'error',
                            message: `Failed to create person '${row.name}': ${await response.text()}`
                        });
                        errorCount++;
                        continue;
                    }
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
                status: row.relevance !== null ? 'pending' : 'relevance'
            };
            
            const response = await fetch('/api/videos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(videoData)
            });
            
            if (response.ok) {
                results.push({
                    row: row.rowNum,
                    status: 'success',
                    message: `Successfully added video for ${row.name}`
                });
                successCount++;
            } else {
                const errorData = await response.json();
                
                // Handle duplicate URLs as "skipped" rather than "error"
                if (response.status === 409 && errorData.error && errorData.error.includes('already exists')) {
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
                        message: errorData.error || 'Failed to add video'
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
        const response = await fetch('/api/admins');
        const admins = await response.json();
        
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
        const response = await fetch('/api/admins', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, name, password })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            if (response.status === 409) {
                showNotification('Admin with this email already exists', 'error');
            } else {
                showNotification(result.error || 'Failed to add admin', 'error');
            }
            return false;
        }
        
        showNotification('Admin added successfully', 'success');
        loadAdmins();
        return true;
    } catch (error) {
        console.error('Error adding admin:', error);
        showNotification('Failed to add admin', 'error');
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
        const response = await fetch(`/api/admins/${adminId}/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: newPassword })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            showNotification(result.error || 'Failed to change password', 'error');
            return;
        }
        
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
        const response = await fetch(`/api/admins/${adminId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            showNotification(result.error || 'Failed to remove admin', 'error');
            return;
        }
        
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
            
            const email = document.getElementById('admin-email').value.trim();
            const name = document.getElementById('admin-name').value.trim();
            const password = document.getElementById('admin-password').value;
            
            if (!email || !password) {
                showNotification('Email and password are required', 'error');
                return;
            }
            
            if (password.length < 4) {
                showNotification('Password must be at least 4 characters long', 'error');
                return;
            }
            
            const success = await addAdmin(email, name || null, password);
            if (success) {
                document.getElementById('admin-email').value = '';
                document.getElementById('admin-name').value = '';
                document.getElementById('admin-password').value = '';
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
        const response = await apiCall(`/api/videos/${videoId}/type`, {
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
            
            const response = await fetch(checkUrl);
            const result = await response.json();
            
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

async function loadAllEntries() {
    try {
        allEntriesData = await apiCall('/api/videos/all/entries');
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
        return;
    }
    
    // Define column order and display names - ALL database columns
    const columns = [
        { key: 'id', label: 'ID', sortable: true },
        { key: 'person_id', label: 'Person ID', sortable: true },
        { key: 'person_name', label: 'Person Name', sortable: true },
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
        { key: 'note', label: 'Note 1', sortable: true },
        { key: 'note_2', label: 'Note 2', sortable: true },
        { key: 'created_at', label: 'Created At', sortable: true },
        { key: 'updated_at', label: 'Updated At', sortable: true }
    ];
    
    // Render header
    headerContainer.innerHTML = columns.map(col => `
        <th class="${col.sortable ? 'sortable' : ''} ${currentSortColumn === col.key ? 'sort-' + currentSortDirection : ''}" 
            ${col.sortable ? `onclick="sortAllEntries('${col.key}')"` : ''}>
            ${col.label}
        </th>
    `).join('');
    
    // Render body
    bodyContainer.innerHTML = data.map(entry => `
        <tr>
            <td>${entry.id || ''}</td>
            <td>${entry.person_id || ''}</td>
            <td>${escapeHtml(entry.person_name || '')}</td>
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
    `).join('');
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
        { key: 'person_name', label: 'Person', sortable: true },
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
            <td>${escapeHtml(entry.person_name || '')}</td>
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

function showNoteModal(videoId, action, existingNote = '') {
    currentNoteVideoId = videoId;
    currentNoteAction = action;
    
    const modal = document.getElementById('noteModal');
    const title = document.getElementById('noteModalTitle');
    const textarea = document.getElementById('noteTextarea');
    const deleteBtn = document.getElementById('noteDeleteBtn');
    
    if (action === 'accept') {
        title.textContent = 'Add Note - Accepting Video';
    } else if (action === 'reject') {
        title.textContent = 'Add Note - Rejecting Video';
    } else {
        title.textContent = 'Edit Note';
    }
    
    textarea.value = existingNote;
    deleteBtn.style.display = existingNote ? 'block' : 'none';
    
    modal.style.display = 'flex';
    textarea.focus();
}

function hideNoteModal() {
    const modal = document.getElementById('noteModal');
    const textarea = document.getElementById('noteTextarea');
    
    modal.style.display = 'none';
    textarea.value = '';
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
            await apiCall(`/api/videos/${currentNoteVideoId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status, note })
            });
            
            hideNoteModal();
            loadVideos(currentTab);
            updateButtonCounts(); // Update navigation counts
            showNotification(`Video ${currentNoteAction}ed with note successfully!`, 'success');
        } else {
            // Edit existing note
            await apiCall(`/api/videos/${currentNoteVideoId}/note`, {
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
        await apiCall(`/api/videos/${currentNoteVideoId}/note`, {
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

// Update button counts in navigation - simplified and faster
async function updateButtonCounts() {
    try {
        console.log('Attempting to fetch button counts...');
        
        // Single API call to get all counts at once
        const response = await fetch('/api/videos/counts');
        console.log('Counts API response status:', response.status, response.ok);
        
        if (!response.ok) {
            console.warn('Counts API not available, using fallback. Status:', response.status);
            return updateButtonCountsFallback();
        }
        
        const counts = await response.json();
        console.log('Button counts received:', counts);
        
        // Update button counts efficiently
        const updates = [
            { id: 'relevance-btn-count', count: counts.relevance || 0 },
            { id: 'pending-btn-count', count: counts.pending || 0 },
            { id: 'accepted-btn-count', count: counts.accepted || 0 },
            { id: 'rejected-btn-count', count: counts.rejected || 0 },
            { id: 'assigned-btn-count', count: counts.assigned || 0 },
            
            // Host 2 counts
            { id: 'host2-pending-btn-count', count: counts.person2_pending || 0 },
            { id: 'host2-accepted-btn-count', count: counts.person2_accepted || 0 },
            { id: 'host2-rejected-btn-count', count: counts.person2_rejected || 0 },
            { id: 'host2-assigned-btn-count', count: counts.person2_assigned || 0 },

            { id: 'all-btn-count', count: counts.all || 0 }
        ];
        
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
                    const response = await fetch(endpoint);
                    const data = await response.json();
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
        tags = await apiCall('/api/tags');
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
        const newTag = await apiCall('/api/tags', {
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
        const updatedTag = await apiCall(`/api/tags/${tagId}`, {
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
        await apiCall(`/api/tags/${tagId}`, {
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
    const modal = document.getElementById('tagSelectionModal');
    const tagsList = document.getElementById('tagSelectionList');
    
    if (!modal || !tagsList) return;
    
    try {
        // Load current video tags
        const videoTags = await apiCall(`/api/videos/${videoId}/tags`);
        const videoTagIds = videoTags.map(tag => tag.id);
        
        // Render tag options
        tagsList.innerHTML = tags.map(tag => `
            <div class="tag-option">
                <input type="checkbox" id="tag-${tag.id}" value="${tag.id}" 
                       ${videoTagIds.includes(tag.id) ? 'checked' : ''}>
                <label for="tag-${tag.id}">${tag.name}</label>
                <span class="tag-option-preview tag-preview" style="background-color: ${tag.color}">${tag.name}</span>
            </div>
        `).join('');
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('Failed to load video tags:', error);
        alert('Failed to load tags. Please try again.');
    }
}

// Hide tag selection modal
function hideTagModal() {
    const modal = document.getElementById('tagSelectionModal');
    if (modal) {
        modal.style.display = 'none';
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
        await apiCall(`/api/videos/${currentVideoId}/tags`, {
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
        return await apiCall(`/api/videos/${videoId}/tags`);
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
