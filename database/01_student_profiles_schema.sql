-- ============================================================================
-- STUDENT PROFILE & AVATAR STORAGE SCHEMA
-- Run this migration in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jtxatrfkxuzeyfhcqlhd/sql/new
-- ============================================================================

-- 1. Extend profiles table with dedicated student profile fields
ALTER TABLE IF EXISTS profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS year TEXT,
ADD COLUMN IF NOT EXISTS semester INT,
ADD COLUMN IF NOT EXISTS register_number TEXT;

-- Ensure Row Level Security (RLS) is enabled on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Row Level Security Policies for profiles
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
    DROP POLICY IF EXISTS "Faculty and admin can view profiles" ON profiles;
END $$;

CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Faculty and admin can view profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid()
            AND p.role IN ('faculty', 'admin')
        )
    );

-- 3. Supabase Storage Bucket Configuration for Student Profiles
-- Bucket: student-profiles (Public bucket for avatar CDN access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-profiles',
    'student-profiles',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 4. Storage Row Level Security Policies for student-profiles bucket
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public can view student avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Students can upload their own avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Students can update their own avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Students can delete their own avatars" ON storage.objects;
END $$;

-- Public can view avatars
CREATE POLICY "Public can view student avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'student-profiles');

-- Tenant-isolated photo upload policy: path must be profiles/{authenticated_user_id}/...
CREATE POLICY "Students can upload their own avatars"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'student-profiles'
        AND (storage.foldername(name))[1] = 'profiles'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

CREATE POLICY "Students can update their own avatars"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'student-profiles'
        AND (storage.foldername(name))[1] = 'profiles'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

CREATE POLICY "Students can delete their own avatars"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'student-profiles'
        AND (storage.foldername(name))[1] = 'profiles'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );
