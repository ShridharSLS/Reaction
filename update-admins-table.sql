-- Update the admins table to use simple email/password authentication
-- Run this SQL in your Supabase SQL editor

-- First, drop the existing admins table if it exists
DROP TABLE IF EXISTS public.admins;

-- Create the new admins table with password field
CREATE TABLE public.admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create index on email for faster lookups
CREATE INDEX idx_admins_email ON public.admins(email);

-- Enable RLS (Row Level Security)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" 
ON public.admins FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Insert the first admin user (change email and password as needed)
INSERT INTO public.admins (email, name, password) 
VALUES ('admin@example.com', 'Admin User', 'admin123');

-- You can add more admin users here
-- INSERT INTO public.admins (email, name, password) 
-- VALUES ('your-email@gmail.com', 'Your Name', 'your-password');
