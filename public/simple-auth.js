// Simple email/password authentication
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const loadingDiv = document.getElementById('loading');
    const loginBtn = document.getElementById('login-btn');

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
        loadingDiv.style.display = 'block';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';
    }

    // Hide loading state
    function hideLoading() {
        loadingDiv.style.display = 'none';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }

    // Handle login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        hideError();
        showLoading();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Store session info
                localStorage.setItem('adminSession', JSON.stringify({
                    email: result.admin.email,
                    name: result.admin.name,
                    loginTime: new Date().toISOString()
                }));

                // Redirect to main dashboard
                window.location.href = '/';
            } else {
                showError(result.error || 'Invalid email or password');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Login failed. Please try again.');
        } finally {
            hideLoading();
        }
    });

    // Check if user is already logged in
    const session = localStorage.getItem('adminSession');
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            // Check if session is still valid (less than 7 days old)
            const loginTime = new Date(sessionData.loginTime);
            const now = new Date();
            const daysSinceLogin = (now - loginTime) / (1000 * 60 * 60 * 24);
            
            if (daysSinceLogin < 7) {
                // Session is still valid, redirect to dashboard
                window.location.href = '/';
                return;
            } else {
                // Session expired, clear it
                localStorage.removeItem('adminSession');
            }
        } catch (e) {
            // Invalid session data, clear it
            localStorage.removeItem('adminSession');
        }
    }
});
