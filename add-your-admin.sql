-- Add your admin account to the system
-- Run this SQL in your Supabase SQL editor

-- First, remove any existing admin with this email (if exists)
DELETE FROM public.admins WHERE email = 'shridhar@shridharlifeschool.com';

-- Add your admin account
INSERT INTO public.admins (email, name, password) 
VALUES ('shridhar@shridharlifeschool.com', 'Shridhar', 'SLS2025');

-- Verify the admin was added
SELECT * FROM public.admins WHERE email = 'shridhar@shridharlifeschool.com';
