// Script to create the admins table in Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminsTable() {
    try {
        console.log('Creating admins table...');
        
        // Create the admins table using SQL
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS public.admins (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    name VARCHAR(255),
                    added_by VARCHAR(255) DEFAULT 'system',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    last_login TIMESTAMP WITH TIME ZONE
                );
                
                -- Create index on email for faster lookups
                CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);
                
                -- Enable RLS (Row Level Security)
                ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
                
                -- Create policy to allow all operations for authenticated users
                CREATE POLICY IF NOT EXISTS "Allow all operations for authenticated users" 
                ON public.admins FOR ALL 
                TO authenticated 
                USING (true) 
                WITH CHECK (true);
            `
        });
        
        if (error) {
            console.error('Error creating table:', error);
            
            // Try alternative approach using direct SQL execution
            console.log('Trying alternative approach...');
            
            // First, let's try to create the table using a simpler approach
            const createResult = await supabase
                .from('admins')
                .select('*')
                .limit(0);
                
            if (createResult.error && createResult.error.code === '42P01') {
                console.log('Table does not exist. You need to create it manually in Supabase dashboard.');
                console.log('Please run this SQL in your Supabase SQL editor:');
                console.log(`
CREATE TABLE public.admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    added_by VARCHAR(255) DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_admins_email ON public.admins(email);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users" 
ON public.admins FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
                `);
                return;
            }
        }
        
        console.log('✅ Admins table created successfully!');
        
        // Now add the first admin
        const email = process.argv[2] || 'pratyashabaruah@gmail.com';
        const name = process.argv[3] || 'Pratyasha Baruah';
        
        console.log(`Adding first admin: ${email}`);
        
        const { data: admin, error: insertError } = await supabase
            .from('admins')
            .insert([{
                email: email.toLowerCase(),
                name: name,
                added_by: 'setup-script'
            }])
            .select()
            .single();
            
        if (insertError) {
            if (insertError.code === '23505') {
                console.log('Admin already exists!');
            } else {
                console.error('Error adding admin:', insertError);
            }
            return;
        }
        
        console.log('✅ First admin added successfully!');
        console.log(`Email: ${admin.email}`);
        console.log(`Name: ${admin.name}`);
        console.log('\nYou can now sign in at: /login');
        
    } catch (err) {
        console.error('Setup failed:', err);
    }
}

createAdminsTable();
