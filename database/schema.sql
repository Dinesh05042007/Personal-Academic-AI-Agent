-- ============================================================================
-- Personal Academic AI Agent: PostgreSQL + pgvector Schema (Supabase)
-- ============================================================================

-- Enable pgvector extension for semantic vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    semester INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on student_id for isolated student queries
CREATE INDEX IF NOT EXISTS idx_courses_student_id ON courses(student_id);

-- 2. Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_course_id ON subjects(course_id);

-- 3. Resources Table (File references in object storage)
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(100) NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- pdf, docx, pptx, txt
    file_path TEXT NOT NULL,         -- student-resources/{student_id}/{course_id}/{subject_id}/{filename}
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_student_id ON resources(student_id);
CREATE INDEX IF NOT EXISTS idx_resources_subject_id ON resources(subject_id);

-- 4. Document Chunks & Vector Store Table
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    student_id VARCHAR(100) NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    unit VARCHAR(100),
    page_number INT,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    -- Default to 1536 dimensions (OpenAI text-embedding-3-small) or 768 (Nomad/Ollama/all-mpnet-base-v2)
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compound index for tenant-scoped vector search queries
CREATE INDEX IF NOT EXISTS idx_chunks_student_resource ON document_chunks(student_id, resource_id);

-- HNSW vector index for high-speed cosine similarity retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- 5. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(100) NOT NULL,
    title VARCHAR(255) DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_student_id ON conversations(student_id);

-- 6. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb, -- Array of { resource_name, page_number, chunk_id }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- ============================================================================
-- Semantic Search RPC Function
-- Strictly enforces student_id boundaries
-- ============================================================================
CREATE OR REPLACE FUNCTION match_document_chunks (
    query_embedding VECTOR(1536),
    match_threshold FLOAT,
    match_count INT,
    filter_student_id VARCHAR(100),
    filter_subject_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    resource_id UUID,
    resource_name VARCHAR(255),
    unit VARCHAR(100),
    page_number INT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.resource_id,
        r.name AS resource_name,
        dc.unit,
        dc.page_number,
        dc.content,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    JOIN resources r ON r.id = dc.resource_id
    WHERE dc.student_id = filter_student_id
      AND (filter_subject_id IS NULL OR dc.subject_id = filter_subject_id)
      AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
