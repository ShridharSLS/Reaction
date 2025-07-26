-- Direct admin insert without RLS complications
-- Run this SQL in your Supabase SQL editor

-- Drop and recreate the table to ensure clean state
DROP TABLE IF EXISTS public.admins CASCADE;

-- Create the admins table without RLS initially
CREATE TABLE public.admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Insert your admin account
INSERT INTO public.admins (email, name, password) 
VALUES ('shridhar@shridharlifeschool.com', 'Shridhar', 'SLS2025');

-- Create index for performance
CREATE INDEX idx_admins_email ON public.admins(email);

-- Verify the admin was added
SELECT * FROM public.admins;
