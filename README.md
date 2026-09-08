# Personal Academic AI Agent 🎓🤖

An autonomous, course-grounded AI academic assistant for engineering students (configured for B.Tech Computer Science & Engineering). The agent indexes private academic materials (PDFs, notes, textbooks) into an isolated vector knowledge base and delivers grounded explanations, university-format exam answers with ASCII architectural diagrams, practice quizzes, and syllabus unit summaries—with zero hallucinations and strict multi-tenant privacy.

---

## 📌 Problem & Solution

* **The Problem**: University course materials are fragmented across unstructured PDFs, lecture slides, syllabus documents, handwritten notes, and previous question papers. Students waste hours scanning through disorganized documents without contextual clarity or personalized tutoring.
* **The Solution**: A private, course-grounded AI assistant that ingests student-uploaded materials, chunks and indexes them with dense embeddings, understands student intent autonomously, and answers strictly from syllabus notes with exact document and page citations.

---

## 🏛️ System Architecture

```text
                                  ┌──────────────────────────┐
                                  │      🎓 Student Web      │
                                  │       (React + Vite)     │
                                  └─────────────┬────────────┘
                                                │ HTTPS
                                                ▼
                                  ┌──────────────────────────┐
                                  │     🛡️ Express Backend   │
                                  │    (Auth, RLS, Storage)  │
                                  └──────┬────────────┬──────┘
                                         │            │
                   ┌─────────────────────┘            └─────────────────────┐
                   ▼                                                        ▼
    ┌───────────────────────────────┐                        ┌──────────────────────────────┐
    │     ⚡ n8n Orchestrator       │                        │     🗄️ Supabase Cloud        │
    │  - Document Ingestion Pipeline│                        │  - Postgres + pgvector       │
    │  - Conversational Agent       │                        │  - Row Level Security (RLS)  │
    │  - Intent & Unit Routing      │                        │  - Private Storage Buckets   │
    └──────────────┬────────────────┘                        │  - Supabase Auth (JWT)       │
                   │                                         └──────────────────────────────┘
                   ▼
    ┌───────────────────────────────┐
    │     🧠 Gemini Pro / Flash     │
    │  - Dense Vector Embeddings    │
    │  - Academic Reasoner & Mode   │
    └───────────────────────────────┘
```

---

## ✨ Key Features & Capabilities

1. **Autonomous Intent Detection & Unit Scoping**:
   * Automatically classifies student questions into one of six intents (`learn`, `exam`, `summary`, `quiz`, `find`, or `general`) without forcing manual mode switching.
   * Extracts curriculum units (e.g., `Unit 1`, `Module 2`) and bounds semantic retrieval strictly to the referenced unit.

2. **5 Academic AI Study Modes**:
   * 📚 **Learn Mode**: Explains challenging concepts with real-world analogies and beginner-friendly breakdowns.
   * 📝 **Exam Mode**: Synthesizes formal 10-mark and 2-mark university model answers complete with structured definitions, key points, and ASCII architectural diagrams.
   * 📄 **Summary Mode**: Generates chapter-level revision summaries and predictable question checklists.
   * 🧠 **Quiz Mode**: Generates targeted self-assessment practice questions with an interactive answer key.
   * 🔍 **Find Mode**: Acts as a precise academic resource locator pinpointing exact file names, page numbers, and quoted snippets.

3. **Strict Zero-Hallucination Boundary**:
   * If a topic is outside the student's uploaded notes, the agent explicitly states:
     > *"I couldn't find enough information about this topic in your uploaded course materials."*
   * Fabricated answers and ghost citations are strictly forbidden.

4. **Multi-Role Academic Governance**:
   * **Student Role**: Accesses personal courses, uploads private study resources, and interacts with the AI tutor.
   * **Faculty Role**: Views aggregated department metrics and manages the official university course catalog.
   * **Admin Role**: Audits platform health, vector chunks, and system user roles.
   * **Strict Privacy Isolation**: Faculty accounts are strictly prohibited from viewing or downloading students' private notes (HTTP 403).

---

## 🔒 Security & Privacy Architecture

* **Database-Level Row Level Security (RLS)**: Enforced across `profiles`, `courses`, `academic_courses`, `subjects`, `resources`, `conversations`, `messages`, and `document_chunks`.
* **2026 Supabase Key Standards**: Browser code uses `VITE_SUPABASE_PUBLISHABLE_KEY`. Server-side code uses `SUPABASE_SECRET_KEY`. Secret keys and AI credentials never reach client bundles.
* **Storage Isolation**: The `student-resources` bucket is private (`public = false`). Direct file access enforces student ownership validation to prevent Insecure Direct Object References (IDOR).
* **Identity Spoofing Defense**: Backend auth middleware rejects client-supplied `student_id` if it diverges from the verified bearer token identity.

---

## 📁 Repository Structure

```text
Personal-Academic-AI-Agent/
├── backend/                       # Node.js Express REST API & RAG engine
│   ├── src/
│   │   ├── academicStore.js       # Academic hierarchy and institutional state
│   │   ├── agentOrchestrator.js   # Intent detection, memory, and study modes
│   │   ├── authMiddleware.js      # Bearer auth, role guards, and spoofing defense
│   │   ├── chunker.js             # Recursive character text chunking
│   │   ├── embeddings.js          # Sentence transformer vector generation
│   │   ├── extractor.js           # Multi-format document parser (PDF, TXT)
│   │   ├── ragService.js          # Grounded synthesis and ASCII diagrams
│   │   ├── storageService.js      # Private multi-tenant file system manager
│   │   └── vectorStore.js         # Fast local pgvector simulation & search
│   ├── tests/                     # Comprehensive automated test suites (Stages 11-20)
│   ├── .env.example               # Sanitized backend environment template
│   └── server.js                  # Production Express server & static SPA host
├── frontend/                      # React 19 + Vite single-page application
│   ├── public/
│   │   └── _redirects             # Client-side routing rewrite for static hosting
│   ├── src/
│   │   ├── components/            # Reusable UI components (MarkdownView, SourceCard, StatCard)
│   │   ├── pages/                 # Role-aware pages (Dashboard, Chat, Faculty, Admin)
│   │   └── services/              # API, Auth, and Supabase client services
│   ├── .env.example               # Sanitized frontend environment template
│   └── vite.config.js             # Vite build configuration
├── database/                      # SQL migrations and security scripts
│   ├── schema.sql                 # Baseline relational and pgvector schema
│   ├── stage14_security_isolation.sql # Full RLS policies for multi-tenancy
│   ├── stage19_faculty_admin_roles.sql # Profiles and role check constraints
│   └── stage20_production_hardening.sql # Production RLS and storage audit
├── documents/                     # Sample academic PDFs and private storage tree
├── n8n/                           # Exported n8n workflow orchestrations
├── package.json                   # Root orchestrator scripts
└── README.md                      # Project documentation manual
```

---

## 🚀 Quick Start & Local Development

### 1. Prerequisites
* **Node.js**: v18+ (tested on Node v24)
* **npm**: v9+
* **Git**: Installed and configured

### 2. Environment Setup
```bash
# Clone the repository
git clone https://github.com/your-username/Personal-Academic-AI-Agent.git
cd Personal-Academic-AI-Agent

# Set up backend environment
cp backend/.env.example backend/.env

# Set up frontend environment
cp frontend/.env.example frontend/.env
```

### 3. Install Dependencies
```bash
# Install root, backend, and frontend dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 4. Build Frontend & Start Unified Server
```bash
# Compile frontend production bundle
npm run build

# Start production server (serves API and SPA on port 3000)
npm start
```

Visit **`http://localhost:3000`** in your browser.

---

## 🧪 Testing & Verification

The project includes an end-to-end automated verification suite covering all 10 project stages:

```bash
# Execute the master test runner
npm run test:all
```

Test coverage includes:
* **Stage 11**: Automatic document ingestion and chunking lifecycle.
* **Stage 12**: Academic study modes and beginner explanations.
* **Stage 13**: 5 Core AI modes with 10-mark model answers.
* **Stage 14**: Security hardening, tenant boundaries, and IDOR prevention.
* **Stage 15**: Background upload pipeline and status polling.
* **Stage 16**: Frontend markdown rendering and verified source cards.
* **Stage 17**: Production deployment and live college evaluation demo.
* **Stage 18**: AI intelligence layer, autonomous intent, and unit scoping.
* **Stage 19**: Faculty/Admin governance and student privacy protection.
* **Stage 20**: Production health monitoring, upload security filters, and 2026 key standards.

---

## 🌐 Production Deployment Guide

### Option A: Render Web Service (Express + Bundled SPA)
1. In Render, create a new **Web Service** connected to your repository.
2. Set Root Directory to `.` (root).
3. Set Build Command to `npm run build`.
4. Set Start Command to `npm start`.
5. Configure environment variables (`PORT`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `N8N_WEBHOOK_URL`).

### Option B: Render Static Site + Backend Web Service
1. **Backend**: Deploy `backend/` as a Render Web Service with `npm start`.
2. **Frontend**: Deploy `frontend/` as a Render Static Site:
   * Build Command: `npm run build`
   * Publish Directory: `dist`
   * Set `VITE_API_URL` to your live backend service URL.
   * `frontend/public/_redirects` automatically rewrites all SPA routes to `/index.html`.

---

## 📜 License

This project is licensed under the MIT License — designed for academic and institutional evaluation.
