-- seed.sql

-- Insert students
INSERT INTO public.students (name, usn, email, branch_code) VALUES
('Abhishek Sharma', '4SH24CS001', 'abhishek@gmail.com', 'CS'),
('Divya Kulkarni', '4SH24CS002', 'divya@gmail.com', 'AI'),
('Ravi Kumar', '4SH24CS003', 'ravi@gmail.com', 'CS'),
('Rahul K', '4SH24CS004', 'rahul@gmail.com', 'IS'),
('Neha Singh', '4SH24CS005', 'neha@gmail.com', 'CS'),
('Vikram Joshi', '4SH24CS006', 'vikram@gmail.com', 'AI'),
('Sneha Rao', '4SH24CS007', 'sneha@gmail.com', 'IS'),
('Karan Patel', '4SH24CS008', 'karan@gmail.com', 'CS'),
('Aisha Reddy', '4SH24CS009', 'aisha@gmail.com', 'AI'),
('Pooja Desai', '4SH24CS010', 'pooja@gmail.com', 'CS'),
('Anil Kapoor', '4SH24CS011', 'anil@gmail.com', 'IS'),
('Sunil Shetty', '4SH24CS012', 'sunil@gmail.com', 'CS'),
('Ritu Verma', '4SH24CS013', 'ritu@gmail.com', 'AI'),
('Amitabh B', '4SH24CS014', 'amitabh@gmail.com', 'IS'),
('Suresh Raina', '4SH24CS015', 'suresh@gmail.com', 'CS'),
('Dhoni MS', '4SH24CS016', 'dhoni@gmail.com', 'AI'),
('Virat Kohli', '4SH24CS017', 'virat@gmail.com', 'CS'),
('Rohit S', '4SH24CS018', 'rohit@gmail.com', 'IS'),
('Shikhar D', '4SH24CS019', 'shikhar@gmail.com', 'CS'),
('Hardik P', '4SH24CS020', 'hardik@gmail.com', 'AI'),
('Jasprit B', '4SH24CS021', 'jasprit@gmail.com', 'CS'),
('Ravindra J', '4SH24CS022', 'ravindra@gmail.com', 'IS'),
('Bhuvi K', '4SH24CS023', 'bhuvi@gmail.com', 'CS'),
('Kuldeep Y', '4SH24CS024', 'kuldeep@gmail.com', 'AI'),
('Chahal Y', '4SH24CS025', 'chahal@gmail.com', 'CS');

-- Insert mentor users
INSERT INTO auth.users (id, role, aud, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, instance_id, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES 
(gen_random_uuid(), 'authenticated', 'authenticated', 'nischay@theboringpeople.in', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"mentor"}', NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
(gen_random_uuid(), 'authenticated', 'authenticated', 'varun@theboringpeople.in', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"mentor"}', NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '', '', '', '');

INSERT INTO public.users (id, email, role, display_name)
SELECT id, email, 'mentor', 'Nischay BK' FROM auth.users WHERE email = 'nischay@theboringpeople.in';

INSERT INTO public.users (id, email, role, display_name)
SELECT id, email, 'mentor', 'Varun' FROM auth.users WHERE email = 'varun@theboringpeople.in';

-- Insert sessions
INSERT INTO public.sessions (date, topic, month_number) VALUES
('2025-08-04', 'Intro to AI', 1),
('2025-08-11', 'Python Basics', 1),
('2025-08-18', 'Data Structures', 1),
('2025-08-25', 'Algorithms', 1),
('2025-09-01', '8-Layer AI Stack', 2),
('2025-09-08', 'ReAct Agent Pattern', 2),
('2025-09-15', 'pgvector RAG', 2),
('2025-09-22', 'Tiered Autonomy Multi-Agent', 2),
('2025-09-29', 'Advanced RAG', 2),
('2025-10-06', 'LLM Fine-tuning', 3),
('2025-10-13', 'Prompt Engineering', 3),
('2025-10-20', 'Vector Databases', 3),
('2025-10-27', 'Agentic Workflows', 3),
('2025-11-03', 'AI Safety & Alignment', 4),
('2025-11-10', 'Capstone Planning', 4);

-- Insert attendance (simulated)
INSERT INTO public.attendance (student_id, session_id, present)
SELECT st.id, s.id, (random() > 0.2)
FROM public.students st
CROSS JOIN public.sessions s;

-- Insert materials
INSERT INTO public.materials (session_id, title, type, url)
SELECT id, 'Slides: ' || topic, 'slides', 'https://docs.google.com/presentation/d/placeholder'
FROM public.sessions;

INSERT INTO public.materials (session_id, title, type, url)
SELECT id, 'Recording: ' || topic, 'recording', 'https://youtube.com/placeholder'
FROM public.sessions;
