# Personal Academic AI Agent

## Project Overview
- **Project**: Personal Academic AI Agent
- **Goal**: Create a personalized AI agent that uses a student's academic resources to provide simple, logical, and course-specific answers.
- **Core Technology**: n8n + LLM + Vector Database + Relational Database + Web App

---

## Problem & Solution
- **Problem**: Academic materials are fragmented across PDFs, PPTs, notes, assignments, and previous question papers. Students waste time hunting for concepts across disorganized files without clear, contextual explanations.
- **Solution**: A private, course-grounded AI agent that indexes a student's own curriculum resources and answers questions with simple explanations, practical examples, exam-focused key points, and exact source citations.

---

## Core Differentiator
Unlike a generic chatbot that produces unverified text from general training data:
1. **Context Understanding**: Interprets the student's question within their active semester, course, and unit context.
2. **Resource Search**: Semantically searches the student's private knowledge base first.
3. **Reasoned Grounding**: Answers directly from retrieved course materials.
4. **Honest Boundary ("Don't Know" Behavior)**: Explicitly states *"I couldn't find enough information about this topic in your uploaded course materials"* rather than hallucinating when notes lack the answer.
5. **Direct Citation**: Appends exact resource file names and page numbers to every answer.

---

## Academic Organization Hierarchy
```text
Student
└── Semester
    └── Course
        └── Subject
            └── Unit
                └── Resources (PDF, DOCX, PPTX, TXT)
```

---

## System Architecture & Knowledge Pipeline

### Ingestion Flow
```text
File Upload (PDF/DOCX/PPTX/TXT)
  ↓
Text Extraction & Cleaning
  ↓
Chunking (Semantic / Recursive)
  ↓
Embeddings Generation
  ↓
Vector DB Storage (with metadata: student_id, course_id, subject_id, unit, page)
```

### Query Flow
```text
Student Question
  ↓
Intent & Context Extraction (Course / Unit)
  ↓
Filtered Vector Search (Strict isolation by student_id)
  ↓
Relevant Chunk Retrieval
  ↓
LLM Synthesis & Reasoning
  ↓
Structured Answer + Source Citations
```

---

## MVP Scope & Phased Roadmap

### Phase 1: MVP (Single Student, PDF Grounding)
- Upload single PDF
- Extract, chunk, and embed text
- Store in vector database with `student_id` filtering
- AI retrieves relevant chunks via n8n orchestration
- Return clear answer + file/page citations
- Validated "don't know" fallback when material is absent

### Phase 2: Expanded Formats & Modes
- Support DOCX, PPTX, and TXT files
- Multi-subject and unit organization
- Chat modes: Normal, Explain Like I'm a Beginner, Exam (10-mark structured answers), Quiz, and Unit Summarization

### Phase 3: Exam Prep & Planning
- Previous year question paper analysis for trend identification
- Dynamic revision and study planning based on exam dates
- Resource locator ("Where is topic X discussed?")

### Phase 4: Full Multi-Agent System
- Agent delegation, automated reminders, and calendar integration
- Multi-student authentication and isolated tenancy

---

## Project Checklist

- [x] Environment Setup (Node.js, npm, Python, Git, workspace structure)
- [x] Base Backend (Express server, CORS, .env configuration)
- [x] Base Frontend (Vite + React initialized and built)
- [x] Database Schema & Architecture Design (PostgreSQL + pgvector schema & search RPC)
- [x] File Storage Hierarchy & Sample Academic Resources
- [x] Document Text Extraction (PDF / TXT parser with header & page preservation)
- [x] Chunking Engine (Recursive character text splitter with overlap & academic metadata)
- [x] Embedding Model Integration (Local 384-d sentence transformer running offline with zero fees)
- [x] Vector Search & Filtering (with strict student_id and subject_id boundaries)
- [x] RAG Query & Synthesis Pipeline (Honest 'don't know' fallback and verified citations)
- [x] n8n Setup & Workflow Configuration (01_Academic_Document_Ingestion.json & 02_Student_Chat_AI_Agent.json)
- [x] Supabase pgvector Setup Script (database/supabase_n8n_setup.sql with match_documents RPC)
- [x] Binary PDF Ingestion Pipeline (Per-page text extraction, metadata attachment, recursive chunking)
- [x] AI Agent Node & System Prompts (Academic Persona, Grounding, Strict Citations)
- [x] Retrieval & Search Tools (student_academic_knowledge with student_id isolation)
- [x] Conversational Memory (Window buffer tracking context & pronouns across turns)
- [x] Multi-Mode Response Synthesis (Normal, Explain, and 10-Mark Exam Mode)
- [x] Student Isolation & Tenant Filtering (Layer 1 App filtering + Layer 2 Database RLS policies)
- [x] Database Security Migration (database/stage7_rls_security.sql with SECURITY INVOKER search function)
- [x] Auth Middleware (backend/src/authMiddleware.js with client spoofing protection & Bearer validation)
- [x] Student Web App (Stage 8: React + Vite + React Router + Axios)
- [x] Authentication Pages (Login & Register with Supabase and demo fallback)
- [x] Student Dashboard (Enrolled courses, subject cards, resource counts, modal uploader)
- [x] AI Chat Interface (Subject switching, multi-mode selector, verified citations, quick chips)
- [x] End-to-End System Integration (Stage 9: React ↔ Express Backend ↔ n8n Webhook / Agent Orchestrator ↔ Student Knowledge Base)
- [x] Dashboard & Resource Management (Stage 10: CourseCard, ResourceCard, Course, Subject, Resources upload with processing status)
- [x] Automatic PDF Background Ingestion & Real-time Status (Stage 11: Webhook ingestion pipeline, status progression, instant semantic search)
- [x] Academic Study Modes (Stage 12: Learn & Explain, Exam 10-Mark Answer, Find in Notes, Unit Summary, Quiz Me, Study Plan Generator)
- [x] 5 Core AI Modes Architecture (Stage 13: 📚 Learn, 📝 Exam with 10-mark/2-mark detection, 📄 Summary, 🧠 Quiz, 🔎 Find, dynamic AI thinking state)
- [x] System Hardening & Security Testing (Stage 14: Storage IDOR defense, adversarial prompt injection defense, cross-subject boundaries, session persistence, and college evaluation guide)
- [x] Automatic Upload & n8n Processing Pipeline (Stage 15: Background upload, status progression polling, failure recovery, and immediate multi-mode recall)
- [x] Professional Frontend & Polish (Stage 16: Course/Subject tabs, markdown rendering, rich source cards)
- [x] AI Intelligence Layer & Autonomous Intent Detection (Stage 18: Autonomous classification across 6 intents, syllabus unit extraction & scoping, ASCII architecture diagrams, interactive mode ribbon with auto-detect)
- [x] Faculty & Admin Dashboard (Stage 19: User roles for student, faculty, admin, requireRole authorization middleware, aggregated platform statistics, private personal file isolation, role-aware sidebar, and official course management)
- [x] Production Hardening & Deployment (Stage 20: Dynamic PORT, GET /health endpoint, upload size and extension filters, sanitized error middleware, SPA client-side rewrite rules, 2026 Supabase key standards, Git ignore rules, production RLS checklist, and publication-ready README.md)
- [x] Final Testing + College Submission Package (Stage 21: Frozen architecture, formal problem statement, project abstract, 10 academic objectives, 16 features, classroom explanations for faculty, 3 ASCII architecture diagrams, 15-question viva catalog, 17-step live demo script, 12-slide presentation structure, future scope, comprehensive submission manual in COLLEGE_EVALUATION_GUIDE.md, and automated 17-point test matrix in test_stage21_submission_test_matrix.js)
- [x] Full Code Audit & Security Inspection (Stage 22: Line-by-line quality & security audit, zero linter warnings across frontend & backend with oxlint, React Hook stabilization with useCallback & cleanup flags, optional catch bindings for error hygiene, 100% idempotent SQL migrations with DROP POLICY IF EXISTS, single-instance PDF extractor parsing, empty input fuzzing resilience, prototype pollution immunity, error normalization, production Vite bundle verification, and automated 8/8 audit suite in test_stage22_code_audit.js)
