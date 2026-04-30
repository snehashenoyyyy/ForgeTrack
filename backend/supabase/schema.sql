-- schema.sql
-- Table definitions
CREATE TABLE public.students (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    usn TEXT UNIQUE NOT NULL,
    admission_number TEXT,
    email TEXT,
    branch_code TEXT NOT NULL,
    batch TEXT DEFAULT '2024-2028',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.sessions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    topic TEXT NOT NULL,
    month_number INTEGER NOT NULL,
    duration_hours DECIMAL(3,1) DEFAULT 2.0,
    session_type TEXT DEFAULT 'offline',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.import_log (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL,
    skipped_rows INTEGER NOT NULL,
    warnings JSONB,
    column_mapping JSONB,
    status TEXT NOT NULL
);

CREATE TABLE public.attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES public.students(id),
    session_id INTEGER NOT NULL REFERENCES public.sessions(id),
    present BOOLEAN NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    marked_by TEXT DEFAULT 'system',
    import_id INTEGER REFERENCES public.import_log(id),
    UNIQUE(student_id, session_id)
);

CREATE TABLE public.materials (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES public.sessions(id),
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('mentor', 'student')),
    student_id INTEGER REFERENCES public.students(id),
    display_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CHECK Constraints
ALTER TABLE public.sessions
    ADD CONSTRAINT check_session_date_past CHECK (date >= '2025-08-04');

ALTER TABLE public.attendance
    -- Ensure attendance date is not in the future. We can't do this easily in a CHECK constraint across tables.
    -- So we'll add a trigger.
    ADD CONSTRAINT check_attendance_marked_at CHECK (marked_at <= NOW() + INTERVAL '1 day');


-- Enable Row Level Security (RLS)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Students Table Policies
CREATE POLICY "mentors_all_students" ON public.students FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'mentor');
CREATE POLICY "students_read_own_student" ON public.students FOR SELECT USING (id = (SELECT student_id FROM public.users WHERE id = auth.uid()));

-- Sessions Table Policies
CREATE POLICY "mentors_all_sessions" ON public.sessions FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'mentor');
CREATE POLICY "students_read_all_sessions" ON public.sessions FOR SELECT USING (true);

-- Attendance Table Policies
CREATE POLICY "mentors_all_attendance" ON public.attendance FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'mentor');
CREATE POLICY "students_read_own_attendance" ON public.attendance FOR SELECT USING (student_id = (SELECT student_id FROM public.users WHERE id = auth.uid()));

-- Materials Table Policies
CREATE POLICY "mentors_all_materials" ON public.materials FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'mentor');
CREATE POLICY "students_read_all_materials" ON public.materials FOR SELECT USING (true);

-- ImportLog Table Policies
CREATE POLICY "mentors_all_import_log" ON public.import_log FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'mentor');

-- Users Table Policies
CREATE POLICY "users_read_all" ON public.users FOR SELECT USING (true);

-- Trigger for Auto-creating User when a Student is inserted
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS TRIGGER AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Create user in auth.users
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', LOWER(NEW.usn) || '@forge.local', crypt(NEW.usn, gen_salt('bf')), NOW(), NULL, NULL, '{"provider":"email","providers":["email"]}', '{"role":"student"}', NOW(), NOW(), '', '', '', '')
    RETURNING id INTO new_user_id;

    -- Create user in public.users
    INSERT INTO public.users (id, email, role, student_id, display_name)
    VALUES (new_user_id, LOWER(NEW.usn) || '@forge.local', 'student', NEW.id, NEW.name);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_student_created
    AFTER INSERT ON public.students
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_student();
