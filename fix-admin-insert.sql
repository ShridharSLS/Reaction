-- Fix admin insertion by temporarily disabling RLS
-- Run this SQL in your Supabase SQL editor

-- Temporarily disable RLS to allow insert
ALTER TABLE public.admins DISABLE ROW LEVEL SECURITY;

-- Clear any existing admins
DELETE FROM public.admins;

-- Insert your admin account
INSERT INTO public.admins (email, name, password) 
VALUES ('shridhar@shridharlifeschool.com', 'Shridhar', 'SLS2025');

-- Re-enable RLS
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Verify the admin was added
SELECT * FROM public.admins;
