-- ============================================================================
-- STAGE 7: SUPABASE ROW LEVEL SECURITY (RLS) & TENANT ISOLATION
-- Ensures students can ONLY view, query, and search their own academic resources.
-- ============================================================================

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Profiles Table (1-to-1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    semester TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Subjects Table
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Resources Table
CREATE TABLE IF NOT EXISTS public.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    processing_status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Document Chunks Table with Vector Support
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    unit TEXT,
    page_number INT,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768), -- Matches Gemini embeddings / 384 for MiniLM
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PERFORMANCE INDEXES (Essential for performant RLS evaluation)
-- ============================================================================
CREATE INDEX IF NOT EXISTS courses_student_id_idx ON public.courses(student_id);
CREATE INDEX IF NOT EXISTS subjects_student_id_idx ON public.subjects(student_id);
CREATE INDEX IF NOT EXISTS resources_student_id_idx ON public.resources(student_id);
CREATE INDEX IF NOT EXISTS document_chunks_student_id_idx ON public.document_chunks(student_id);
CREATE INDEX IF NOT EXISTS document_chunks_subject_idx ON public.document_chunks(student_id, subject_id);
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES (Strict auth.uid() tenant boundary)
-- ============================================================================

-- Drop existing policies for idempotent re-execution
DROP POLICY IF EXISTS "Students can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Students can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Students can view their own courses" ON public.courses;
DROP POLICY IF EXISTS "Students can insert their own courses" ON public.courses;
DROP POLICY IF EXISTS "Students can update their own courses" ON public.courses;
DROP POLICY IF EXISTS "Students can delete their own courses" ON public.courses;
DROP POLICY IF EXISTS "Students can view their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Students can insert their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Students can delete their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Students can view their own resources" ON public.resources;
DROP POLICY IF EXISTS "Students can insert their own resources" ON public.resources;
DROP POLICY IF EXISTS "Students can delete their own resources" ON public.resources;
DROP POLICY IF EXISTS "Students can view their own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Students can insert their own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Students can delete their own document chunks" ON public.document_chunks;

-- Profiles Policies
CREATE POLICY "Students can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING ((select auth.uid()) = id);

CREATE POLICY "Students can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING ((select auth.uid()) = id);

-- Courses Policies
CREATE POLICY "Students can view their own courses"
ON public.courses FOR SELECT
TO authenticated
USING ((select auth.uid()) = student_id);

CREATE POLICY "Students can insert their own courses"
ON public.courses FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can update their own courses"
ON public.courses FOR UPDATE
TO authenticated
USING ((select auth.uid()) = student_id);

CREATE POLICY "Students can delete their own courses"
ON public.courses FOR DELETE
TO authenticated
USING ((select auth.uid()) = student_id);

-- Subjects Policies
CREATE POLICY "Students can view their own subjects"
ON public.subjects FOR SELECT
TO authenticated
USING ((select auth.uid()) = student_id);

CREATE POLICY "Students can insert their own subjects"
ON public.subjects FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can delete their own subjects"
ON public.subjects FOR DELETE
TO authenticated
USING ((select auth.uid()) = student_id);

-- Resources Policies
CREATE POLICY "Students can view their own resources"
ON public.resources FOR SELECT
TO authenticated
USING ((select auth.uid()) = student_id);

CREATE POLICY "Students can insert their own resources"
ON public.resources FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can delete their own resources"
ON public.resources FOR DELETE
TO authenticated
USING ((select auth.uid()) = student_id);

-- Document Chunks Policies
CREATE POLICY "Students can view their own document chunks"
ON public.document_chunks FOR SELECT
TO authenticated
USING ((select auth.uid()) = student_id);

CREATE POLICY "Students can insert their own document chunks"
ON public.document_chunks FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = student_id);

-- ============================================================================
-- SECURE VECTOR SEARCH FUNCTION (WITH RLS ENFORCEMENT VIA SECURITY INVOKER)
-- Because SECURITY INVOKER is specified, PostgreSQL runs the function using the
-- caller's permissions, automatically applying the RLS policies above!
-- ============================================================================
CREATE OR REPLACE FUNCTION match_student_documents (
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 5,
    filter_subject_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    resource_id UUID,
    unit TEXT,
    page_number INT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER -- Critical: Enforces RLS of the active authenticated user
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.resource_id,
        dc.unit,
        dc.page_number,
        dc.content,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    WHERE dc.student_id = (select auth.uid())
      AND (filter_subject_id IS NULL OR dc.subject_id = filter_subject_id)
      AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
