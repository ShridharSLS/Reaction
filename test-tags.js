// Test script to verify tags functionality
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testTagsAPI() {
    console.log('Testing Tags API endpoints...\n');
    
    try {
        // Test 1: Get all tags (should work even if empty)
        console.log('1. Testing GET /api/tags');
        const tagsResponse = await fetch(`${BASE_URL}/api/tags`);
        const tagsData = await tagsResponse.json();
        
        if (tagsResponse.ok) {
            console.log('✅ GET /api/tags - Success');
            console.log('   Current tags:', tagsData);
        } else {
            console.log('❌ GET /api/tags - Failed');
            console.log('   Error:', tagsData);
        }
        
        // Test 2: Try to create a test tag
        console.log('\n2. Testing POST /api/tags');
        const createResponse = await fetch(`${BASE_URL}/api/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: 'Test Tag', 
                color: '#ff6b6b' 
            })
        });
        const createData = await createResponse.json();
        
        if (createResponse.ok) {
            console.log('✅ POST /api/tags - Success');
            console.log('   Created tag:', createData);
        } else {
            console.log('❌ POST /api/tags - Failed');
            console.log('   Error:', createData);
            
            // Check if it's a table doesn't exist error
            if (createData.error && createData.error.includes('relation "tags" does not exist')) {
                console.log('\n🔧 SOLUTION: The tags table needs to be created in the database.');
                console.log('   Please run the following SQL in your Supabase dashboard:');
                console.log('   1. Go to https://supabase.com/dashboard');
                console.log('   2. Open your project');
                console.log('   3. Go to SQL Editor');
                console.log('   4. Run the contents of add-tags-feature.sql');
            }
        }
        
    } catch (error) {
        console.log('❌ Network error:', error.message);
    }
}

testTagsAPI();
