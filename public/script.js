// Global state
let currentTab = 'add-topic';
let people = [];
let confirmationCallback = null;
let videoIdCallback = null;

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
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    
    currentTab = tabId;
    
    // Load data for the new tab
    if (tabId === 'manage-people') {
        loadPeople();
    } else if (tabId !== 'add-topic') {
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
        people = await apiCall('/api/people');
        updatePersonSelect();
        updatePeopleList();
    } catch (error) {
        console.error('Failed to load people:', error);
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
        container.innerHTML = '<div class="empty-state"><h3>No people added yet</h3><p>Add people who can submit video topics.</p></div>';
        return;
    }
    
    container.innerHTML = people.map(person => `
        <div class="person-item">
            <input type="text" value="${escapeHtml(person.name)}" 
                   onchange="updatePersonName(${person.id}, this.value)" 
                   class="person-name-input">
            <button onclick="deletePerson(${person.id})" 
                    class="btn btn-danger btn-small" 
                    title="Delete person">
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
    const score = video.score || 0;
    const relevanceRating = video.relevance_rating || '';
    
    return `
        <div class="video-card ${typeClass}">
            <div class="video-header">
                <div class="video-info">
                    <h3>${escapeHtml(video.added_by_name)}</h3>
                    <div class="video-meta">${formatDate(video.link_added_on)}</div>
                </div>
                <span class="video-type ${typeClass}">${video.type}</span>
            </div>
            
            <div class="video-details">
                <div class="detail-item link-item">
                    <span class="detail-label">Link</span>
                    <a href="${escapeHtml(video.link)}" target="_blank" class="link-icon" title="${escapeHtml(video.link)}">
                        🔗
                    </a>
                </div>
                
                <div class="detail-item">
                    <span class="detail-label">Likes</span>
                    <span class="detail-value">${video.likes_count || 0}</span>
                </div>
                
                <div class="detail-item">
                    <span class="detail-label">Relevance</span>
                    <span class="detail-value">
                        ${status === 'pending' || status === 'accepted' ? 
                            `<select onchange="updateRelevance(${video.id}, this.value)" style="width: 60px; padding: 2px 4px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="" ${relevanceRating === '' ? 'selected' : ''}>-</option>
                                <option value="0" ${relevanceRating == 0 ? 'selected' : ''}>0</option>
                                <option value="1" ${relevanceRating == 1 ? 'selected' : ''}>1</option>
                                <option value="2" ${relevanceRating == 2 ? 'selected' : ''}>2</option>
                                <option value="3" ${relevanceRating == 3 ? 'selected' : ''}>3</option>
                            </select>` : 
                            (relevanceRating !== '' ? relevanceRating : '-')
                        }
                    </span>
                </div>
                
                <div class="detail-item">
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
                <button class="btn btn-danger" onclick="rejectVideo(${video.id})">❌ Reject</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">🗑️ Delete</button>
            `;
        case 'accepted':
            return `
                <button class="btn btn-primary" onclick="assignVideoId(${video.id})">🆔 Assign ID</button>
                <button class="btn btn-danger" onclick="rejectVideo(${video.id})">❌ Reject</button>
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
                <button class="btn btn-warning" onclick="revertToAccepted(${video.id})">↩️ Accepted</button>
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
            alert('Video topic added successfully!');
            
            // Refresh pending videos if that tab is active
            if (currentTab === 'pending') {
                loadVideos('pending');
            }
        } catch (error) {
            console.error('Failed to add video:', error);
        }
    });
    
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
            alert('Person added successfully!');
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
        document.getElementById('video-id-modal').style.display = 'none';
        document.getElementById('video-id-input').value = '';
        videoIdCallback = null;
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        const confirmModal = document.getElementById('confirmation-modal');
        const videoIdModal = document.getElementById('video-id-modal');
        
        if (event.target === confirmModal) {
            confirmModal.style.display = 'none';
            confirmationCallback = null;
        }
        
        if (event.target === videoIdModal) {
            videoIdModal.style.display = 'none';
            document.getElementById('video-id-input').value = '';
            videoIdCallback = null;
        }
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

function truncateUrl(url, maxLength = 50) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
}
