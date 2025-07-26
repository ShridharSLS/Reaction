// Supabase client will be initialized after config is loaded
let supabaseClient = null;

// Initialize Supabase client with config from server
async function initializeSupabase() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        const { createClient } = supabase;
        supabaseClient = createClient(config.url, config.anonKey);
        
        return supabaseClient;
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        showError('Failed to initialize authentication system');
        return null;
    }
}

// DOM elements
const googleSigninBtn = document.getElementById('google-signin-btn');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// Hide error message
function hideError() {
    errorMessage.style.display = 'none';
}

// Show loading state
function showLoading() {
    loading.style.display = 'block';
    googleSigninBtn.style.display = 'none';
}

// Hide loading state
function hideLoading() {
    loading.style.display = 'none';
    googleSigninBtn.style.display = 'flex';
}

// Check if user is already logged in
async function checkAuthStatus() {
    try {
        if (!supabaseClient) {
            await initializeSupabase();
        }
        
        if (!supabaseClient) {
            showError('Authentication system not available');
            return;
        }
        
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Auth check error:', error);
            return;
        }
        
        if (session) {
            // User is logged in, verify they're an admin
            await verifyAdminAccess(session.user);
        }
    } catch (error) {
        console.error('Auth status check failed:', error);
    }
}

// Verify admin access
async function verifyAdminAccess(user) {
    try {
        showLoading();
        
        // Check if user email is in admins table
        const response = await fetch('/api/verify-admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabaseClient.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({ email: user.email })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.isAdmin) {
                // Update last login
                await updateLastLogin(user.email);
                // Redirect to main dashboard
                window.location.href = '/';
            } else {
                await supabaseClient.auth.signOut();
                showError('Access denied. Your email is not authorized to access this system.');
                hideLoading();
            }
        } else {
            await supabaseClient.auth.signOut();
            showError('Unable to verify admin access. Please try again.');
            hideLoading();
        }
    } catch (error) {
        console.error('Admin verification failed:', error);
        await supabaseClient.auth.signOut();
        showError('Authentication failed. Please try again.');
        hideLoading();
    }
}

// Update last login timestamp
async function updateLastLogin(email) {
    try {
        await fetch('/api/update-last-login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabaseClient.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({ email })
        });
    } catch (error) {
        console.error('Failed to update last login:', error);
        // Non-critical error, don't block login
    }
}

// Handle Google Sign-In
async function handleGoogleSignIn() {
    try {
        hideError();
        showLoading();
        
        if (!supabaseClient) {
            await initializeSupabase();
        }
        
        if (!supabaseClient) {
            showError('Authentication system not available');
            hideLoading();
            return;
        }
        
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/login.html`
            }
        });
        
        if (error) {
            console.error('Google sign-in error:', error);
            showError('Failed to sign in with Google. Please try again.');
            hideLoading();
        }
        // If successful, the page will redirect to Google OAuth
    } catch (error) {
        console.error('Sign-in failed:', error);
        showError('Sign-in failed. Please try again.');
        hideLoading();
    }
}

// Initialize auth state change handler after Supabase is ready
async function setupAuthStateHandler() {
    if (!supabaseClient) {
        await initializeSupabase();
    }
    
    if (supabaseClient) {
        // Handle auth state changes
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event, session);
            
            if (event === 'SIGNED_IN' && session) {
                // User just signed in, verify admin access
                await verifyAdminAccess(session.user);
            } else if (event === 'SIGNED_OUT') {
                // User signed out, stay on login page
                hideLoading();
            }
        });
    }
}

// Event listeners
googleSigninBtn.addEventListener('click', handleGoogleSignIn);

// Check auth status on page load
document.addEventListener('DOMContentLoaded', async () => {
    await setupAuthStateHandler();
    await checkAuthStatus();
});

// Handle URL parameters (for OAuth redirects)
window.addEventListener('load', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    if (error) {
        showError(errorDescription || 'Authentication failed');
        hideLoading();
    }
});
