-- cleanup.sql
-- Safely removes all dummy seed data while preserving real mentor accounts.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor).

-- Step 1: Delete attendance records first (references students + sessions)
DELETE FROM public.attendance;

-- Step 2: Delete materials (references sessions)
DELETE FROM public.materials;

-- Step 3: Delete import logs (standalone)
DELETE FROM public.import_log;

-- Step 4: Delete student entries from public.users
-- (students were auto-created by the on_student_created trigger)
DELETE FROM public.users WHERE role = 'student';

-- Step 5: Delete student auth accounts
-- (auto-created with @forge.local emails by the trigger)
DELETE FROM auth.users WHERE email LIKE '%@forge.local';

-- Step 6: Delete all students
DELETE FROM public.students;

-- Step 7: Delete all sessions
DELETE FROM public.sessions;

-- Done! Mentor accounts (nischay@theboringpeople.in, varun@theboringpeople.in)
-- are preserved in both auth.users and public.users.
