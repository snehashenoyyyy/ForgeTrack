-- seed.sql

-- Insert mentor users into auth
INSERT INTO auth.users (id, role, aud, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, instance_id, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES 
(gen_random_uuid(), 'authenticated', 'authenticated', 'nischay@theboringpeople.in', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"mentor"}', NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
(gen_random_uuid(), 'authenticated', 'authenticated', 'varun@theboringpeople.in', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"mentor"}', NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '', '', '', '');

-- Link mentor users to public.users
INSERT INTO public.users (id, email, role, display_name)
SELECT id, email, 'mentor', 'Nischay BK' FROM auth.users WHERE email = 'nischay@theboringpeople.in';

INSERT INTO public.users (id, email, role, display_name)
SELECT id, email, 'mentor', 'Varun' FROM auth.users WHERE email = 'varun@theboringpeople.in';
