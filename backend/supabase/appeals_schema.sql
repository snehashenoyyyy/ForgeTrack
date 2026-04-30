-- Create the attendance appeals table
CREATE TABLE IF NOT EXISTS public.attendance_appeals (
    id SERIAL PRIMARY KEY,
    student_id BIGINT REFERENCES public.students(id) ON DELETE CASCADE,
    session_id BIGINT REFERENCES public.sessions(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES auth.users(id),
    UNIQUE(student_id, session_id)
);

-- Enable RLS
ALTER TABLE public.attendance_appeals ENABLE ROW LEVEL SECURITY;

-- Simple policies for development (Disable for absolute ease, or add basic ones)
-- For now, let's allow all authenticated users to read/write for demo purposes
CREATE POLICY "Enable all for users" ON public.attendance_appeals FOR ALL USING (true);
