// Script to add the first admin user to the system
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addFirstAdmin() {
    try {
        // Get email from command line argument or use default
        const email = process.argv[2] || 'your-email@gmail.com';
        const name = process.argv[3] || 'Admin User';
        
        console.log(`Adding first admin: ${email}`);
        
        // Check if admin already exists
        const { data: existingAdmin } = await supabase
            .from('admins')
            .select('email')
            .eq('email', email.toLowerCase())
            .single();
            
        if (existingAdmin) {
            console.log('Admin already exists!');
            return;
        }
        
        // Add the admin
        const { data, error } = await supabase
            .from('admins')
            .insert([{
                email: email.toLowerCase(),
                name: name,
                added_by: 'setup-script'
            }])
            .select()
            .single();
            
        if (error) {
            console.error('Error adding admin:', error);
            return;
        }
        
        console.log('✅ First admin added successfully!');
        console.log(`Email: ${data.email}`);
        console.log(`Name: ${data.name}`);
        console.log('\nYou can now sign in at: /login');
        
    } catch (err) {
        console.error('Setup failed:', err);
    }
}

addFirstAdmin();
