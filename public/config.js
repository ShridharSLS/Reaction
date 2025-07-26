// Frontend configuration - this will be populated by the server
window.SUPABASE_CONFIG = {
    url: '',
    anonKey: ''
};

// Function to load config from server
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        window.SUPABASE_CONFIG = config;
        return config;
    } catch (error) {
        console.error('Failed to load configuration:', error);
        return null;
    }
}
