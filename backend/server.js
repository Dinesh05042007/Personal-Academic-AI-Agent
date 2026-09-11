const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { defaultRAGService } = require("./src/ragService");
const { defaultStore } = require("./src/vectorStore");
const { defaultAgentOrchestrator } = require("./src/agentOrchestrator");
const { requireStudentAuth, requireRole, verifyStudentResourceOwnership } = require("./src/authMiddleware");
const { defaultAcademicStore } = require("./src/academicStore");
const { defaultStorageService } = require("./src/storageService");
const { warmUpEmbeddingModel } = require("./src/embeddings");

const app = express();

app.use(cors());

// Normalize duplicate /api/api prefixes defensively
app.use((req, res, next) => {
  if (req.url.startsWith("/api/api/")) {
    req.url = req.url.replace(/^\/api\/api\//, "/api/");
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Configure file upload storage
const uploadDir = path.join(__dirname, "../documents/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File upload security restrictions (Step 705)
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".docx", ".pptx"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, uniqueSuffix + "-" + sanitizedName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB max limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Unsupported file format '${ext}'. Allowed formats: PDF, TXT, DOCX, PPTX.`));
    }
    cb(null, true);
  }
});

// Profile photo upload configuration
const ALLOWED_PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_PHOTO_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Unsupported image format '${ext}'. Allowed formats: JPG, JPEG, PNG, WEBP.`));
    }
    cb(null, true);
  }
});

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const { createClient } = require("@supabase/supabase-js");
    return createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    return null;
  }
}

// Production Health Check Endpoint (Step 687 & 696)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "personal-academic-ai-backend"
  });
});

// Production Health Check & Info Endpoints
app.get("/api/info", (req, res) => {
  res.json({
    message: "Personal Academic AI Agent backend is running!",
    stored_chunks_count: defaultStore.getCount()
  });
});

// Model readiness endpoint — shows whether ONNX warm-up has completed
app.get("/api/readiness", (req, res) => {
  const { isModelReady } = require("./src/embeddings");
  const ready = isModelReady();
  res.status(ready ? 200 : 503).json({
    model_ready: ready,
    message: ready
      ? "Embedding model is loaded and ready for uploads."
      : "Embedding model is still warming up. Uploads may be slower on this first request."
  });
});

app.get("/", (req, res, next) => {
  const frontendDistPath = path.join(__dirname, "../frontend/dist/index.html");
  if (fs.existsSync(frontendDistPath)) {
    return res.sendFile(frontendDistPath);
  }
  res.json({
    message: "Personal Academic AI Agent backend is running!",
    stored_chunks_count: defaultStore.getCount()
  });
});

// Server-side Student Registration Endpoint
app.post("/api/auth/register", async (req, res) => {
  const { email, password, full_name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required for registration." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Server configuration missing: SUPABASE_URL or SUPABASE_SECRET_KEY" });
  }

  try {
    const { createClient } = require("@supabase/supabase-js");
    const supabaseServer = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabaseServer.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: full_name || "Student User", role: "student" }
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "Registration successful", user: data.user, session: data.session });
  } catch (err) {
    res.status(500).json({ error: "Registration error: " + err.message });
  }
});

// Server-side Student Login Endpoint
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Server configuration missing: SUPABASE_URL or SUPABASE_SECRET_KEY" });
  }

  try {
    const { createClient } = require("@supabase/supabase-js");
    const supabaseServer = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "Login successful", user: data.user, session: data.session });
  } catch (err) {
    res.status(500).json({ error: "Login error: " + err.message });
  }
});

// Current user identity endpoint
app.get("/api/auth/me", requireStudentAuth, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user
  });
});

// Courses API
app.get("/api/student/courses", requireStudentAuth, (req, res) => {
  const courses = defaultAcademicStore.getCourses(req.user.student_id);
  res.json({ courses });
});

app.post("/api/student/courses", requireStudentAuth, (req, res) => {
  const { name, semester } = req.body;
  if (!name) return res.status(400).json({ error: "Course name is required" });
  const course = defaultAcademicStore.addCourse(req.user.student_id, name, semester);
  res.json({ message: "Course created successfully", course });
});

// Subjects API
app.get("/api/student/subjects", requireStudentAuth, (req, res) => {
  const { course_id } = req.query;
  const subjects = defaultAcademicStore.getSubjects(req.user.student_id, course_id);
  res.json({ subjects });
});

app.post("/api/student/subjects", requireStudentAuth, (req, res) => {
  const { course_id, name, code } = req.body;
  if (!course_id || !name) return res.status(400).json({ error: "course_id and name are required" });
  const subject = defaultAcademicStore.addSubject(req.user.student_id, course_id, name, code);
  res.json({ message: "Subject created successfully", subject });
});

// Resources API
app.get("/api/student/resources", requireStudentAuth, (req, res) => {
  const { subject_id } = req.query;
  const resources = defaultAcademicStore.getResources(req.user.student_id, subject_id);
  res.json({ resources });
});

// --- Student Profile & Photo Endpoints ---

// Get current student's profile
app.get("/api/student/profile", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.user.student_id || req.user.id;
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentId)
        .maybeSingle();

      if (!error && data) {
        defaultAcademicStore.updateProfile(studentId, data);
        return res.json({ profile: data });
      }
    }

    const profile = defaultAcademicStore.getProfile(studentId, req.user);
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch student profile: " + err.message });
  }
});

// Update current student's profile
app.put("/api/student/profile", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.user.student_id || req.user.id;
    const { name, bio, department, year, semester, register_number } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (department !== undefined) updates.department = department;
    if (year !== undefined) updates.year = year;
    if (semester !== undefined) updates.semester = semester;
    if (register_number !== undefined) updates.register_number = register_number;

    const supabase = getSupabaseAdminClient();
    let updatedProfile = null;
    if (supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", studentId)
        .select()
        .maybeSingle();

      if (!error && data) {
        updatedProfile = data;
      }
    }

    const localUpdated = defaultAcademicStore.updateProfile(studentId, updates);
    res.json({
      message: "Profile updated successfully",
      profile: updatedProfile || localUpdated
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile: " + err.message });
  }
});

// Upload student profile photo (Supabase Storage with local fallback)
app.post("/api/student/profile/photo", requireStudentAuth, photoUpload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No photo file uploaded. Please select an image." });
    }

    const studentId = req.user.student_id || req.user.id;
    const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
    const filename = `avatar_${Date.now()}${ext}`;
    const storagePath = `profiles/${studentId}/${filename}`;
    let avatarUrl = null;

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { error: uploadError } = await supabase.storage
          .from("student-profiles")
          .upload(storagePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("student-profiles")
            .getPublicUrl(storagePath);
          if (publicUrlData && publicUrlData.publicUrl) {
            avatarUrl = publicUrlData.publicUrl;
          }
        } else {
          console.warn("Supabase storage upload failed, using local storage fallback:", uploadError.message);
        }
      } catch (storageErr) {
        console.warn("Supabase storage exception:", storageErr.message);
      }
    }

    // Local storage fallback
    if (!avatarUrl) {
      const localProfileDir = path.join(__dirname, "../documents/storage/profiles", studentId);
      if (!fs.existsSync(localProfileDir)) {
        fs.mkdirSync(localProfileDir, { recursive: true });
      }
      const localFilePath = path.join(localProfileDir, filename);
      fs.writeFileSync(localFilePath, req.file.buffer);
      avatarUrl = `/api/storage/profile-photo?file=${encodeURIComponent(filename)}&student_id=${encodeURIComponent(studentId)}`;
    }

    // Save avatar_url in database & local academic store
    if (supabase) {
      await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", studentId);
    }

    const updatedProfile = defaultAcademicStore.updateProfile(studentId, { avatar_url: avatarUrl });
    res.json({
      message: "Profile photo uploaded successfully",
      avatar_url: avatarUrl,
      profile: updatedProfile
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload photo: " + err.message });
  }
});

// Remove student profile photo
app.delete("/api/student/profile/photo", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.user.student_id || req.user.id;
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", studentId);
    }
    const updated = defaultAcademicStore.updateProfile(studentId, { avatar_url: null });
    res.json({ message: "Profile photo removed successfully", profile: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove photo: " + err.message });
  }
});

// Stream profile photo from local storage fallback
app.get("/api/storage/profile-photo", (req, res) => {
  try {
    const studentId = req.query.student_id;
    const filename = req.query.file;
    if (!studentId || !filename) {
      return res.status(400).json({ error: "Missing student_id or file parameter." });
    }
    // Prevent directory traversal
    const safeStudentId = path.basename(studentId);
    const safeFilename = path.basename(filename);
    const profileDir = path.join(__dirname, "../documents/storage/profiles", safeStudentId);
    const filePath = path.join(profileDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Profile photo not found." });
    }
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve profile photo: " + err.message });
  }
});

// --- Stage 19: Faculty & Admin Institutional Management Endpoints ---

/**
 * Endpoint: GET /api/admin/stats (Step 656 & 658)
 * Returns aggregated institutional statistics.
 * Protected: requires role 'faculty' or 'admin'.
 */
app.get("/api/admin/stats", requireStudentAuth, requireRole(["faculty", "admin"]), (req, res) => {
  const stats = defaultAcademicStore.getPlatformStats();
  res.json({
    success: true,
    user_role: req.user.role,
    stats
  });
});

/**
 * Endpoint: GET /api/admin/courses (Step 660)
 * Returns institutional course catalog.
 * Protected: requires role 'faculty' or 'admin'.
 */
app.get("/api/admin/courses", requireStudentAuth, requireRole(["faculty", "admin"]), (req, res) => {
  const courses = defaultAcademicStore.getAllCourses();
  res.json({
    success: true,
    courses
  });
});

/**
 * Endpoint: POST /api/admin/courses (Step 660)
 * Allows faculty/admin to create an official academic course.
 * Protected: requires role 'faculty' or 'admin'.
 */
app.post("/api/admin/courses", requireStudentAuth, requireRole(["faculty", "admin"]), (req, res) => {
  const { name, semester, code } = req.body;
  if (!name) return res.status(400).json({ error: "Course name is required" });
  const course = defaultAcademicStore.createOfficialCourse(name, semester, code, req.user.id);
  res.json({
    message: "Official academic course created successfully",
    course
  });
});

/**
 * Endpoint: GET /api/admin/users
 * Returns list of platform users for role and account auditing.
 * Protected: requires role 'admin'.
 */
app.get("/api/admin/users", requireStudentAuth, requireRole(["admin"]), (req, res) => {
  const users = defaultAcademicStore.getAllUsers();
  res.json({
    success: true,
    users_count: users.length,
    users
  });
});

/**
 * Endpoint: POST /api/resources/ingest
 * Protected with strict tenant auth.
 * Hard 120-second timeout: Render free-tier can be slow on first ONNX use.
 */
app.post("/api/resources/ingest", requireStudentAuth, upload.single("file"), async (req, res) => {
  const reqStart = Date.now();
  let timeoutHandle;

  // Hard request timeout — avoids indefinite hang visible to the student
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(
        "Ingestion timed out after 120 seconds. The AI model may still be loading on the server — please retry in 30 seconds."
      ));
    }, 120_000);
  });

  try {
    const student_id = req.user.student_id;
    const { course_id, subject_id, unit, resource_name, text_content } = req.body;

    let inputSource;
    let mimeType = "text/plain";
    let actualResourceName = resource_name || "Document";

    if (req.file) {
      inputSource = req.file.path;
      mimeType = req.file.mimetype;
      actualResourceName = resource_name || req.file.originalname;
      const fileSizeKB = Math.round(req.file.size / 1024);
      console.log(`[UPLOAD] File received: "${actualResourceName}" (${fileSizeKB} KB, ${mimeType}), student_id=${student_id}`);
    } else if (text_content) {
      inputSource = text_content;
      mimeType = "text/plain";
      actualResourceName = resource_name || "Text_Notes.txt";
      console.log(`[UPLOAD] Text content received: ${text_content.length} chars, student_id=${student_id}`);
    } else {
      return res.status(400).json({ error: "Either a file or text_content must be provided" });
    }

    const result = await Promise.race([
      defaultRAGService.ingestDocument(inputSource, {
        student_id,
        course_id,
        subject_id,
        unit,
        resource_name: actualResourceName,
        mimeType
      }),
      timeoutPromise
    ]);

    clearTimeout(timeoutHandle);
    console.log(`[UPLOAD] Ingest complete in ${Date.now() - reqStart}ms, chunks=${result.chunks_count}`);

    // Also register in academic store
    const savedResource = defaultAcademicStore.addResource(student_id, {
      course_id,
      subject_id,
      name: actualResourceName,
      unit,
      file_type: mimeType.includes("pdf") ? "pdf" : "txt",
      file_path: typeof inputSource === "string" ? inputSource : "in-memory",
      processing_status: "completed"
    });

    res.json({
      message: "Resource ingested successfully into student knowledge base",
      resource: savedResource,
      ...result
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    console.error(`[UPLOAD] Ingestion error after ${Date.now() - reqStart}ms:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: GET /api/storage/file
 * Serves private academic files with strict tenant isolation and IDOR prevention
 */
app.get("/api/storage/file", requireStudentAuth, (req, res) => {
  try {
    const { path: relPath } = req.query;
    if (!relPath) return res.status(400).json({ error: "File path is required" });

    // CRITICAL IDOR & TENANT ISOLATION CHECK:
    if (!verifyStudentResourceOwnership(req.user.student_id, relPath)) {
      return res.status(403).json({ error: "Access Denied: You do not have permission to access this resource" });
    }

    const absPath = defaultStorageService.resolvePath(relPath);
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: "File not found" });
    res.sendFile(absPath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Endpoint: GET /api/student/resources/:resourceId/status
 * Check live processing status of an uploaded document
 */
app.get("/api/student/resources/:resourceId/status", requireStudentAuth, (req, res) => {
  const resource = defaultAcademicStore.getResourceById(req.params.resourceId);
  if (!resource) return res.status(404).json({ error: "Resource not found" });
  res.json({
    resource_id: resource.id,
    name: resource.name,
    processing_status: resource.processing_status || "completed"
  });
});

/**
 * Endpoint: PATCH /api/student/resources/:resourceId/status
 * Update processing status (e.g. called by n8n after completing vector ingestion)
 */
app.patch("/api/student/resources/:resourceId/status", (req, res) => {
  const { processing_status } = req.body;
  const updated = defaultAcademicStore.updateResourceStatus(req.params.resourceId, processing_status);
  if (!updated) return res.status(404).json({ error: "Resource not found" });
  res.json({
    message: "Status updated",
    resource: updated
  });
});

/**
 * Endpoint: POST /api/process-resource (Step 384)
 * Triggers automated document ingestion (n8n Webhook or local pipeline) with status progression
 */
app.post("/api/process-resource", requireStudentAuth, async (req, res) => {
  const { resource_id, subject_id, course_id, file_path, resource_name } = req.body;
  const student_id = req.user.student_id;

  if (!resource_id || !file_path) {
    return res.status(400).json({ error: "resource_id and file_path are required" });
  }

  // 1. Set status to processing
  defaultAcademicStore.updateResourceStatus(resource_id, "processing");

  try {
    const n8nIngestUrl = process.env.N8N_INGESTION_WEBHOOK_URL;
    if (n8nIngestUrl && n8nIngestUrl.startsWith("http")) {
      try {
        await axios.post(n8nIngestUrl, {
          resource_id,
          student_id,
          subject_id,
          course_id,
          file_path,
          resource_name
        }, { timeout: 10000 });

        defaultAcademicStore.updateResourceStatus(resource_id, "completed");
        return res.json({
          success: true,
          resource_id,
          processing_status: "completed",
          orchestrator: "n8n_ingestion_webhook"
        });
      } catch (n8nErr) {
        console.warn("n8n ingestion webhook unavailable, executing internal processor:", n8nErr.message);
      }
    }

    // Direct Processing fallback
    const absPath = path.isAbsolute(file_path)
      ? file_path
      : path.resolve(__dirname, file_path);

    const ingestResult = await defaultRAGService.ingestDocument(absPath, {
      student_id,
      course_id: course_id || "course_btech_cse",
      subject_id: subject_id || "subj_os",
      resource_id,
      resource_name: resource_name || path.basename(file_path),
      mimeType: file_path.endsWith(".pdf") ? "application/pdf" : "text/plain"
    });

    defaultAcademicStore.updateResourceStatus(resource_id, "completed");

    res.json({
      success: true,
      resource_id,
      processing_status: "completed",
      chunks_count: ingestResult.chunks_count,
      pages_count: ingestResult.pages_count,
      orchestrator: "internal_processor"
    });
  } catch (err) {
    defaultAcademicStore.updateResourceStatus(resource_id, "failed", err.message);
    console.error("Automated processing failed:", err);
    res.status(500).json({ error: "Processing failed: " + err.message });
  }
});

/**
 * Endpoint: POST /api/search
 * Protected vector search strictly bounded to authenticated student
 */
app.post("/api/search", requireStudentAuth, async (req, res) => {
  try {
    const student_id = req.user.student_id;
    const { query, subject_id, course_id, unit, topK, similarityThreshold } = req.body;

    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const { generateEmbedding } = require("./src/embeddings");
    const queryVector = await generateEmbedding(query);
    const matches = defaultStore.search(queryVector, {
      student_id,
      subject_id,
      course_id,
      unit,
      topK: topK || 5,
      similarityThreshold: similarityThreshold !== undefined ? similarityThreshold : 0.3
    });

    res.json({
      query,
      student_id,
      matches_count: matches.length,
      matches
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/ask
 * Protected RAG QA
 */
app.post("/api/ask", requireStudentAuth, async (req, res) => {
  try {
    const student_id = req.user.student_id;
    const { question, subject_id, course_id, unit, mode, topK, similarityThreshold } = req.body;

    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }

    const response = await defaultRAGService.queryKnowledge(question, {
      student_id,
      subject_id,
      course_id,
      unit,
      mode: mode || "NORMAL",
      topK: topK || 3,
      similarityThreshold: similarityThreshold !== undefined ? similarityThreshold : 0.32
    });

    res.json(response);
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/agent/chat
 * State-aware AI Agent entrypoint with student tenant isolation
 */
app.post("/api/agent/chat", requireStudentAuth, async (req, res) => {
  try {
    const student_id = req.user.student_id;
    const { question, conversation_id, subject_id, course_id, unit, mode } = req.body;

    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }

    const response = await defaultAgentOrchestrator.processUserMessage({
      student_id,
      question,
      conversation_id: conversation_id || "default_session",
      subject_id,
      course_id,
      unit,
      mode: mode || "NORMAL"
    });

    res.json(response);
  } catch (err) {
    console.error("Agent chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

const ACADEMIC_MODES = [
  {
    id: "AUTO",
    name: "Auto Detect",
    icon: "🎯",
    description: "Automatically detects intent (learn, exam, summary, quiz, find) and syllabus unit from your question.",
    sample_prompt: "Explain dual-mode operation for 10 marks"
  },
  {
    id: "NORMAL",
    name: "Normal Q&A",
    icon: "📘",
    description: "Clear, direct conceptual explanations grounded in your curriculum notes.",
    sample_prompt: "What is a process?"
  },
  {
    id: "EXPLAIN",
    name: "Learn & Explain",
    icon: "💡",
    description: "Intuitive breakdowns using real-world analogies and zero technical jargon.",
    sample_prompt: "Explain process scheduling in simple words with an analogy"
  },
  {
    id: "EXAM",
    name: "10-Mark Exam Answer",
    icon: "📝",
    description: "Structured university exam format with definition, ASCII diagram, and scoring points.",
    sample_prompt: "Give me a 10-mark answer on dual-mode operation"
  },
  {
    id: "FIND",
    name: "Find in Notes",
    icon: "🔍",
    description: "Pinpoint exact PDFs, page numbers, and quoted snippets where a topic appears.",
    sample_prompt: "Where is process scheduling defined in my notes?"
  },
  {
    id: "SUMMARY",
    name: "Unit Summary",
    icon: "📚",
    description: "Chapter-level revision summary with concept checklists and predicted exam questions.",
    sample_prompt: "Summarize Unit 1 Process Management"
  },
  {
    id: "QUIZ",
    name: "Quiz Me",
    icon: "🧠",
    description: "Interactive multiple-choice practice quiz generated directly from your uploaded materials.",
    sample_prompt: "Quiz me on CPU scheduling and process states"
  },
  {
    id: "STUDY_PLAN",
    name: "Study Plan Generator",
    icon: "📅",
    description: "Customized day-by-day revision timetable optimized for exam preparation.",
    sample_prompt: "Create a 5-day study plan for Unit 1"
  }
];

/**
 * Endpoint: GET /api/academic/modes
 * Returns all supported study modes, descriptions, and sample prompts
 */
app.get("/api/academic/modes", (req, res) => {
  res.json({ modes: ACADEMIC_MODES });
});

/**
 * Endpoint: POST /api/chat (Step 292)
 * Primary chat endpoint: Forwards to n8n Webhook if configured, with agent fallback
 */
app.post("/api/chat", requireStudentAuth, async (req, res) => {
  try {
    const student_id = req.user.student_id;
    const { question, course_id, subject_id, conversation_id, mode } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required." });
    }

    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nUrl && n8nUrl.startsWith("http") && !n8nUrl.includes("YOUR_N8N")) {
      try {
        const response = await axios.post(
          n8nUrl,
          {
            question,
            student_id,
            course_id,
            subject_id,
            conversation_id: conversation_id || ("session_" + student_id),
            sessionId: conversation_id || ("session_" + student_id),
            mode: mode || "NORMAL"
          },
          { timeout: 45000 }
        );

        const out = response.data?.output || response.data?.answer || response.data;
        return res.json({
          output: typeof out === "string" ? out : JSON.stringify(out),
          answer: typeof out === "string" ? out : JSON.stringify(out),
          sources: response.data?.sources || [],
          found_in_notes: response.data?.found_in_notes !== undefined ? response.data.found_in_notes : true,
          source_orchestrator: "n8n_webhook"
        });
      } catch (n8nErr) {
        console.warn("n8n webhook call failed or unreachable, seamlessly routing to agent orchestrator:", n8nErr.message);
      }
    }

    // Direct Agent Execution
    const response = await defaultAgentOrchestrator.processUserMessage({
      student_id,
      question,
      conversation_id: conversation_id || ("session_" + student_id),
      subject_id,
      course_id,
      mode: mode || "NORMAL"
    });

    res.json({
      output: response.answer,
      answer: response.answer,
      sources: response.sources || [],
      found_in_notes: response.found_in_notes,
      conversation_id: response.conversation_id,
      source_orchestrator: "agent_orchestrator",
      mode: response.mode,
      intent: response.intent,
      detected_unit: response.detected_unit
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Unable to contact AI agent: " + err.message });
  }
});

/**
 * Endpoint: GET /api/chat/history
 * Retrieves stored multi-turn conversation history for session persistence
 */
app.get("/api/chat/history", requireStudentAuth, (req, res) => {
  const { conversation_id } = req.query;
  if (!conversation_id) {
    return res.status(400).json({ error: "conversation_id query parameter is required" });
  }
  try {
    const history = defaultAgentOrchestrator.getConversationHistory(conversation_id, req.user.student_id);
    res.json({
      conversation_id,
      student_id: req.user.student_id,
      history
    });
  } catch (err) {
    if (err.message && err.message.includes("Access Denied")) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: DELETE /api/chat/history
 * Clears multi-turn conversation history for a clean slate
 */
app.delete("/api/chat/history", requireStudentAuth, (req, res) => {
  const { conversation_id } = req.query;
  if (!conversation_id) {
    return res.status(400).json({ error: "conversation_id query parameter is required" });
  }
  try {
    defaultAgentOrchestrator.clearMemory(conversation_id, req.user.student_id);
    res.json({
      message: "Conversation history cleared successfully",
      conversation_id
    });
  } catch (err) {
    if (err.message && err.message.includes("Access Denied")) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: GET /api/chat/conversations
 * Retrieves all conversations for the authenticated student, optionally filtered by subject
 */
app.get("/api/chat/conversations", requireStudentAuth, (req, res) => {
  try {
    const { subject_id } = req.query;
    const conversations = defaultAgentOrchestrator.getConversations(req.user.student_id, subject_id);
    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/chat/conversations
 * Creates a new conversation for the student and subject
 */
app.post("/api/chat/conversations", requireStudentAuth, (req, res) => {
  try {
    const { subject_id, title } = req.body;
    const conversation = defaultAgentOrchestrator.createConversation(
      req.user.student_id,
      subject_id,
      title || "Academic Chat"
    );
    res.json({ conversation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: GET /api/chat/messages
 * Retrieves messages for a specific conversation
 */
app.get("/api/chat/messages", requireStudentAuth, (req, res) => {
  try {
    const { conversation_id } = req.query;
    if (!conversation_id) {
      return res.status(400).json({ error: "conversation_id is required" });
    }
    const messages = defaultAgentOrchestrator.getConversationHistory(conversation_id, req.user.student_id);
    res.json({ messages });
  } catch (err) {
    if (err.message && err.message.includes("Access Denied")) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/chat/messages
 * Saves an individual message into a conversation
 */
app.post("/api/chat/messages", requireStudentAuth, (req, res) => {
  try {
    const { conversation_id, role, content, sources } = req.body;
    if (!conversation_id || !role || !content) {
      return res.status(400).json({ error: "conversation_id, role, and content are required" });
    }
    defaultAgentOrchestrator.addMessage(
      conversation_id,
      role,
      content,
      sources || [],
      req.user.student_id
    );
    res.json({ success: true, conversation_id, role });
  } catch (err) {
    if (err.message && err.message.includes("Access Denied")) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Production Static Frontend Hosting (Stage 17)
const frontendDist = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/webhook") ||
      req.path.startsWith("/storage") ||
      req.path === "/health"
    ) {
      return next();
    }
    if (req.method === "GET") {
      return res.sendFile(path.join(frontendDist, "index.html"));
    }
    next();
  });
}

// Centralized Error Handling Middleware (Step 704)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size exceeds the allowed limit (max 5MB for profile photos, 25MB for course materials)." });
    }
    return res.status(400).json({ error: "File upload error: " + err.message });
  }
  if (err.message && (err.message.includes("Unsupported file format") || err.message.includes("Unsupported image format"))) {
    return res.status(400).json({ error: err.message });
  }
  console.error("Internal Server Error:", err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "An unexpected error occurred. Please try again."
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
    // Pre-warm ONNX embedding model immediately after server binds.
    // This downloads model_quantized.onnx (~22MB) from HuggingFace at boot time
    // so the first student upload does NOT trigger a slow model download.
    warmUpEmbeddingModel();
  });
}

module.exports = app;
