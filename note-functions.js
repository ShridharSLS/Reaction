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
    if (!note || note.trim() === '') {
        return '';
    }
    
    const firstWord = note.trim().split(' ')[0];
    const displayText = note.length > firstWord.length ? `${firstWord}...` : firstWord;
    const escapedNote = escapeHtml(note).replace(/'/g, '\\\'');
    
    return `
        <span class="note-display">
            <span class="note-text">${escapeHtml(displayText)}</span>
            <button class="note-edit-btn" onclick="showNoteModal(${videoId}, 'edit', '${escapedNote}')" title="Edit note">
                ✏️
            </button>
        </span>
    `;
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
