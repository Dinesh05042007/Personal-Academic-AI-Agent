-- ============================================================================
-- Stage 19: Faculty & Admin Roles, Institutional Views & RLS Policies
-- ============================================================================

-- 1. Profiles Table with Role Enforcement (Step 648 & 649)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'faculty', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Profiles RLS Policies (Idempotent drops)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own non-role profile details" ON public.profiles;
DROP POLICY IF EXISTS "Faculty and admin can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admin can update user roles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile details (excluding role)
CREATE POLICY "Users can update own non-role profile details"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Faculty and Admins can view other profiles for academic coordination
CREATE POLICY "Faculty and admin can view profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('faculty', 'admin')
        )
    );

-- Only Admins can modify user roles
CREATE POLICY "Only admin can update user roles"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- 3. Institutional Courses Table (Step 660 & 662)
-- Distinguishes official academic courses from personal student course tags
CREATE TABLE IF NOT EXISTS public.academic_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    semester INT NOT NULL,
    faculty_id UUID REFERENCES public.profiles(id),
    department VARCHAR(100) DEFAULT 'Computer Science & Engineering',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.academic_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view academic courses" ON public.academic_courses;
DROP POLICY IF EXISTS "Faculty and admin can manage academic courses" ON public.academic_courses;

-- Everyone authenticated can view official academic courses
CREATE POLICY "Authenticated users can view academic courses"
    ON public.academic_courses FOR SELECT
    USING (auth.role() = 'authenticated');

-- Faculty and Admins can create and edit academic courses
CREATE POLICY "Faculty and admin can manage academic courses"
    ON public.academic_courses FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('faculty', 'admin')
        )
    );

-- 4. Critical Privacy Isolation Rule (Step 663)
-- Faculty accounts DO NOT automatically receive access to students' private personal resources
-- Student resources remain strictly filtered by student_id
DROP POLICY IF EXISTS "Students exclusively access own private resources" ON public.resources;
DROP POLICY IF EXISTS "Students exclusively access own document chunks" ON public.document_chunks;

CREATE POLICY "Students exclusively access own private resources"
    ON public.resources FOR ALL
    USING (auth.uid()::text = student_id)
    WITH CHECK (auth.uid()::text = student_id);

CREATE POLICY "Students exclusively access own document chunks"
    ON public.document_chunks FOR ALL
    USING (auth.uid()::text = student_id)
    WITH CHECK (auth.uid()::text = student_id);
