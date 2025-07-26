// Global state
let currentTab = 'pending';
let people = [];
let confirmationCallback = null;
let videoIdCallback = null;

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
    initializeTabs();
    loadPeople();
    setupForms();
    setupModals();
    
    // Load initial data for active tab
    if (currentTab !== 'add-topic' && currentTab !== 'manage-people') {
        loadVideos(currentTab);
    }
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
    const isTasksDropdownTab = ['add-topic', 'bulk-import', 'manage-people', 'manage-admins'].includes(tabId);
    const isClosedDropdownTab = ['rejected', 'assigned', 'team'].includes(tabId);
    
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
    } else if (tabId === 'manage-admins') {
        initializeAdminManagement();
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
        const videos = await apiCall(`/api/videos/${status}`);
        updateVideosDisplay(status, videos);
    } catch (error) {
        console.error(`Failed to load ${status} videos:`, error);
    }
}

function updateVideosDisplay(status, videos) {
    const container = document.getElementById(`${status}-videos`);
    
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
                <div class="video-info">
                    <h3 title="${escapeHtml(video.added_by_name)}">${truncateName(video.added_by_name)}</h3>
                    <div class="video-meta">${formatDate(video.link_added_on)}</div>
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
                    <span class="detail-label">Link</span>
                    <a href="${escapeHtml(video.link)}" target="_blank" class="link-icon" title="${escapeHtml(video.link)}">
                        🔗
                    </a>
                </div>
                
                <div class="detail-item likes-item">
                    <span class="detail-label">Likes</span>
                    <span class="detail-value">${video.likes_count || 0}</span>
                </div>
                
                <div class="detail-item relevance-item">
                    <span class="detail-label">Relevance</span>
                    <span class="detail-value">
                        ${status === 'relevance' || status === 'pending' || status === 'accepted' ? 
                            `<select onchange="updateRelevance(${video.id}, this.value)" style="width: 60px; padding: 2px 4px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px;">
                                ${status === 'relevance' ? 
                                    `<option value="-1" ${relevanceRating === '-1' ? 'selected' : ''}>-1</option>` : 
                                    `<option value="" ${relevanceRating === '' ? 'selected' : ''}>-</option>`
                                }
                                <option value="0" ${relevanceRating == 0 ? 'selected' : ''}>0</option>
                                <option value="1" ${relevanceRating == 1 ? 'selected' : ''}>1</option>
                                <option value="2" ${relevanceRating == 2 ? 'selected' : ''}>2</option>
                                <option value="3" ${relevanceRating == 3 ? 'selected' : ''}>3</option>
                            </select>` : 
                            (relevanceRating !== '' ? relevanceRating : '-')
                        }
                    </span>
                </div>
                
                <div class="detail-item score-item">
                    <span class="detail-label">Score</span>
                    <span class="detail-value score">${score}</span>
                </div>
                
                ${video.video_id_text ? `
                    <div class="detail-item">
                        <span class="detail-label">Video ID</span>
                        <span class="detail-value">
                            <input type="text" value="${escapeHtml(video.video_id_text)}" 
                                   onchange="updateVideoId(${video.id}, this.value)" 
                                   style="width: 60px; padding: 2px 4px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px;">
                            <button onclick="clearVideoId(${video.id})" 
                                    style="margin-left: 4px; padding: 1px 4px; font-size: 10px; background: #dc3545; color: white; border: none; border-radius: 2px; cursor: pointer;" 
                                    title="Clear Video ID">×</button>
                        </span>
                    </div>
                ` : ''}
            </div>
            
            <div class="video-actions">
                ${getVideoActions(video, status)}
            </div>
        </div>
    `;
}

function getVideoActions(video, status) {
    switch (status) {
        case 'pending':
            return `
                <button class="btn btn-success" onclick="acceptVideo(${video.id})">✅ Accept</button>
                <button class="btn btn-primary" onclick="assignVideoId(${video.id})">👨‍💼 Shridhar</button>
                <button class="btn btn-team" onclick="assignVideoToTeam(${video.id})">👥 Team</button>
                <button class="btn btn-reject" onclick="rejectVideo(${video.id})">❌ Reject</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">🗑️ Delete</button>
            `;
        case 'accepted':
            return `
                <button class="btn btn-primary" onclick="assignVideoId(${video.id})">👨‍💼 Shridhar</button>
                <button class="btn btn-team" onclick="assignVideoToTeam(${video.id})">👥 Team</button>
                <button class="btn btn-reject" onclick="rejectVideo(${video.id})">❌ Reject</button>
                <button class="btn btn-warning" onclick="revertToPending(${video.id})">↩️ Pending</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">🗑️ Delete</button>
            `;
        case 'rejected':
            return `
                <button class="btn btn-success" onclick="acceptVideo(${video.id})">✅ Accept</button>
                <button class="btn btn-warning" onclick="revertToPending(${video.id})">↩️ Pending</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">🗑️ Delete</button>
            `;
        case 'assigned':
            return `
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">🗑️ Delete</button>
            `;
        case 'team':
            return `
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">🗑️ Delete</button>
            `;
        case 'relevance':
            return `
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">🗑️ Delete</button>
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
    // Confirmation Modal
    document.getElementById('modal-cancel').addEventListener('click', function() {
        document.getElementById('confirmation-modal').style.display = 'none';
        confirmationCallback = null;
    });
    
    document.getElementById('modal-confirm').addEventListener('click', function() {
        if (confirmationCallback) {
            confirmationCallback();
        }
        document.getElementById('confirmation-modal').style.display = 'none';
        confirmationCallback = null;
    });
    
    // Video ID Modal
    document.getElementById('video-id-cancel').addEventListener('click', function() {
        document.getElementById('video-id-modal').style.display = 'none';
        document.getElementById('video-id-input').value = '';
        videoIdCallback = null;
    });
    
    document.getElementById('video-id-confirm').addEventListener('click', function() {
        const videoId = document.getElementById('video-id-input').value.trim();
        if (videoId && videoIdCallback) {
            videoIdCallback(videoId);
        }
        
        // Close the modal after submission
        document.getElementById('video-id-modal').style.display = 'none';
        document.getElementById('video-id-input').value = '';
        videoIdCallback = null;
    });
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

async function acceptVideo(videoId) {
    try {
        await apiCall(`/api/videos/${videoId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'accepted' })
        });
        loadVideos(currentTab);
    } catch (error) {
        console.error('Failed to accept video:', error);
    }
}

async function rejectVideo(videoId) {
    try {
        await apiCall(`/api/videos/${videoId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'rejected' })
        });
        loadVideos(currentTab);
    } catch (error) {
        console.error('Failed to reject video:', error);
    }
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

function assignVideoToTeam(videoId) {
    showVideoIdInput(async (videoIdText) => {
        try {
            await apiCall(`/api/videos/${videoId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    status: 'team',
                    video_id_text: videoIdText
                })
            });
            loadVideos(currentTab);
        } catch (error) {
            console.error('Failed to assign video to team:', error);
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
    link.href = `/api/export/${status}`;
    link.download = `${status}_videos.csv`;
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
