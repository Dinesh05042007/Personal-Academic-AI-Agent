-- ============================================================================
-- STAGE 14: COMPLETE SUPABASE ROW LEVEL SECURITY (RLS) & TENANT ISOLATION
-- Codifies Steps 490 - 530: Strict user isolation across database, storage, and retrieval.
-- ============================================================================

-- 1. Ensure extensions exist
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Conversations Table with student_id foreign key (Step 515)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT DEFAULT 'Academic Chat Session',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure student_id column exists if table was created previously
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Messages Table linked to conversations (Step 517)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) ACROSS ALL TABLES (Steps 494 & 516)
-- ============================================================================
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- If document_chunks exists, enable RLS
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_chunks') THEN
        ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
        ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================================
-- DROP EXISTING POLICIES (Idempotent replay support)
-- ============================================================================
DROP POLICY IF EXISTS "Students can view their own courses" ON public.courses;
DROP POLICY IF EXISTS "Students can create their own courses" ON public.courses;
DROP POLICY IF EXISTS "Students can update their own courses" ON public.courses;
DROP POLICY IF EXISTS "Students can delete their own courses" ON public.courses;

DROP POLICY IF EXISTS "Students can view their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Students can create their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Students can update their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Students can delete their own subjects" ON public.subjects;

DROP POLICY IF EXISTS "Students can view their own resources" ON public.resources;
DROP POLICY IF EXISTS "Students can create their own resources" ON public.resources;
DROP POLICY IF EXISTS "Students can update their own resources" ON public.resources;
DROP POLICY IF EXISTS "Students can delete their own resources" ON public.resources;

DROP POLICY IF EXISTS "Students can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Students can create their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Students can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Students can delete their own conversations" ON public.conversations;

DROP POLICY IF EXISTS "Students can view their conversation messages" ON public.messages;
DROP POLICY IF EXISTS "Students can insert their conversation messages" ON public.messages;

-- ============================================================================
-- COURSES POLICIES (Steps 495 - 498)
-- ============================================================================
CREATE POLICY "Students can view their own courses"
ON public.courses FOR SELECT
TO authenticated
USING ((select auth.uid()) = student_id);

CREATE POLICY "Students can create their own courses"
ON public.courses FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can update their own courses"
ON public.courses FOR UPDATE
TO authenticated
USING ((select auth.uid()) = student_id)
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can delete their own courses"
ON public.courses FOR DELETE
TO authenticated
USING ((select auth.uid()) = student_id);

-- ============================================================================
-- SUBJECTS POLICIES (Steps 499 - 502)
-- ============================================================================
CREATE POLICY "Students can view their own subjects"
ON public.subjects FOR SELECT
TO authenticated
USING ((select auth.uid()) = student_id);

CREATE POLICY "Students can create their own subjects"
ON public.subjects FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can update their own subjects"
ON public.subjects FOR UPDATE
TO authenticated
USING ((select auth.uid()) = student_id)
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can delete their own subjects"
ON public.subjects FOR DELETE
TO authenticated
USING ((select auth.uid()) = student_id);

-- ============================================================================
-- RESOURCES POLICIES (Steps 503 - 506)
-- ============================================================================
CREATE POLICY "Students can view their own resources"
ON public.resources FOR SELECT
TO authenticated
USING ((select auth.uid()) = student_id);

CREATE POLICY "Students can create their own resources"
ON public.resources FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can update their own resources"
ON public.resources FOR UPDATE
TO authenticated
USING ((select auth.uid()) = student_id)
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can delete their own resources"
ON public.resources FOR DELETE
TO authenticated
USING ((select auth.uid()) = student_id);

-- ============================================================================
-- CONVERSATIONS POLICIES (Step 516)
-- ============================================================================
CREATE POLICY "Students can view their own conversations"
ON public.conversations FOR SELECT
TO authenticated
USING ((select auth.uid()) = student_id);

CREATE POLICY "Students can create their own conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can update their own conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING ((select auth.uid()) = student_id)
WITH CHECK ((select auth.uid()) = student_id);

CREATE POLICY "Students can delete their own conversations"
ON public.conversations FOR DELETE
TO authenticated
USING ((select auth.uid()) = student_id);

-- ============================================================================
-- MESSAGES POLICIES (Step 517: Messages inherit conversation ownership)
-- ============================================================================
CREATE POLICY "Students can view their conversation messages"
ON public.messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = messages.conversation_id 
          AND c.student_id = (select auth.uid())
    )
);

CREATE POLICY "Students can insert their conversation messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = messages.conversation_id 
          AND c.student_id = (select auth.uid())
    )
);

-- ============================================================================
-- SUPABASE STORAGE OBJECT POLICIES (Steps 508 - 510)
-- Bucket 'student-resources' must be PRIVATE.
-- Policy restricts file reads and writes to: auth.uid() = first folder in path
-- ============================================================================
-- 1. Insert/Upload policy
DROP POLICY IF EXISTS "Students can upload to own storage folder" ON storage.objects;
CREATE POLICY "Students can upload to own storage folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'student-resources' 
    AND (storage.foldername(name))[1] = (select auth.uid())::text
);

-- 2. Select/Read policy
DROP POLICY IF EXISTS "Students can read own storage files" ON storage.objects;
CREATE POLICY "Students can read own storage files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'student-resources' 
    AND (storage.foldername(name))[1] = (select auth.uid())::text
);

-- 3. Delete policy
DROP POLICY IF EXISTS "Students can delete own storage files" ON storage.objects;
CREATE POLICY "Students can delete own storage files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'student-resources' 
    AND (storage.foldername(name))[1] = (select auth.uid())::text
);
