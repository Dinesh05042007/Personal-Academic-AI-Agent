import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const api = axios.create({
  baseURL: API_BASE,
});

// Automatically inject Bearer authentication token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("academic_ai_token") || "token_student_A";
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function fetchCurrentUser() {
  try {
    const res = await api.get("/api/auth/me");
    return res.data;
  } catch {
    return {
      authenticated: true,
      user: { id: "student_001", student_id: "student_001", email: "dinesh@academic.edu", name: "Dinesh" }
    };
  }
}

export async function fetchCourses() {
  try {
    const res = await api.get("/api/student/courses");
    return res.data.courses || [];
  } catch {
    return [
      { id: "course_btech_cse", name: "B.Tech Computer Science & Engineering", semester: 3 }
    ];
  }
}

export async function fetchSubjects(courseId = null) {
  try {
    const url = courseId ? `/api/student/subjects?course_id=${courseId}` : "/api/student/subjects";
    const res = await api.get(url);
    return res.data.subjects || [];
  } catch {
    return [
      { id: "subj_os", name: "Operating Systems", code: "CS301", course_id: "course_btech_cse" },
      { id: "subj_dbms", name: "Database Management Systems", code: "CS302", course_id: "course_btech_cse" },
      { id: "subj_csharp", name: "C# Programming", code: "CS303", course_id: "course_btech_cse" },
      { id: "subj_cn", name: "Computer Networks", code: "CS304", course_id: "course_btech_cse" }
    ];
  }
}

export async function fetchResources(subjectId = null) {
  try {
    const url = subjectId ? `/api/student/resources?subject_id=${subjectId}` : "/api/student/resources";
    const res = await api.get(url);
    return res.data.resources || [];
  } catch {
    return [
      { id: "res_1", name: "Operating Systems Unit 1.pdf", unit: "Unit 1", file_type: "pdf" }
    ];
  }
}

export async function uploadResourceFile(formData) {
  const res = await api.post("/api/resources/ingest", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return res.data;
}

export async function sendAgentMessage({ question, conversation_id, subject_id, course_id, mode }) {
  const res = await api.post("/api/chat", {
    question,
    conversation_id: conversation_id || "web_session",
    subject_id,
    course_id,
    mode: mode || "auto"
  });

  return res.data;
}

export async function fetchChatHistory(conversationId) {
  try {
    const res = await api.get(`/api/chat/history?conversation_id=${encodeURIComponent(conversationId)}`);
    return res.data.history || [];
  } catch {
    return [];
  }
}

export async function clearChatHistory(conversationId) {
  try {
    const res = await api.delete(`/api/chat/history?conversation_id=${encodeURIComponent(conversationId)}`);
    return res.data;
  } catch {
    return null;
  }
}

export default api;
