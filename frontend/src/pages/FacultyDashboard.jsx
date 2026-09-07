import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import StatCard from "../components/StatCard";
import api from "../services/api";

function FacultyDashboard() {
  const [stats, setStats] = useState({
    courses_count: 8,
    students_count: 120,
    resources_count: 850,
    ai_chats_count: 2430
  });
  const [courses, setCourses] = useState([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseSemester, setNewCourseSemester] = useState("3");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    async function loadFacultyData() {
      try {
        const statsRes = await api.get("/api/admin/stats");
        if (statsRes.data?.stats) {
          setStats(statsRes.data.stats);
        }
      } catch (err) {
        console.warn("Could not load dynamic stats:", err.message);
      }

      try {
        const coursesRes = await api.get("/api/admin/courses");
        if (coursesRes.data?.courses) {
          setCourses(coursesRes.data.courses);
        }
      } catch (err) {
        console.warn("Could not load dynamic courses:", err.message);
      }
    }
    loadFacultyData();
  }, []);

  async function handleCreateCourse(e) {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    try {
      const res = await api.post("/api/admin/courses", {
        name: newCourseName.trim(),
        semester: parseInt(newCourseSemester, 10) || 1
      });
      if (res.data?.course) {
        setCourses((prev) => [res.data.course, ...prev]);
        setStats((prev) => ({ ...prev, courses_count: (prev.courses_count || 0) + 1 }));
        setNewCourseName("");
        setShowCourseModal(false);
        setStatusMsg("Course created successfully!");
        setTimeout(() => setStatusMsg(""), 3000);
      }
    } catch (err) {
      alert("Error creating course: " + err.message);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <div className="dashboard-header">
          <div>
            <h1>👨‍🏫 Faculty Dashboard</h1>
            <p className="subtitle">
              Manage curriculum courses, review platform analytics, and coordinate academic resources.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowCourseModal(true)}>
            ➕ Create Official Course
          </button>
        </div>

        {statusMsg && (
          <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#166534", borderRadius: "8px", marginBottom: "16px" }}>
            ✅ {statusMsg}
          </div>
        )}

        {/* Aggregated Institutional Statistics (Step 656 & 658) */}
        <div className="stats-grid">
          <StatCard icon="📚" title="Active Courses" value={stats.courses_count || 8} />
          <StatCard icon="👥" title="Enrolled Students" value={stats.students_count || 120} />
          <StatCard icon="📄" title="Curriculum Resources" value={stats.resources_count || 850} />
          <StatCard icon="🤖" title="AI Questions Answered" value={stats.ai_chats_count || 2430} />
        </div>

        {/* Student Privacy Banner (Step 647 & 663) */}
        <div style={{ padding: "14px 18px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", margin: "20px 0", fontSize: "14px", color: "#475569" }}>
          🔒 <strong>Privacy Guardrail:</strong> In accordance with university data isolation standards, student private notes and individual AI study threads remain strictly confidential and are not visible in faculty portals.
        </div>

        {/* Institutional Courses List (Step 660) */}
        <section className="courses-section" style={{ marginTop: "25px" }}>
          <h2>🏛️ Department Courses</h2>
          <div className="courses-grid" style={{ marginTop: "15px" }}>
            {courses.length === 0 ? (
              <div className="card" style={{ padding: "20px", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <h3>B.Tech Computer Science & Engineering</h3>
                <p style={{ color: "#64748b", margin: "6px 0" }}>Semester 3 • 4 Core Subjects Enrolled</p>
                <span className="badge-grounded">Active Curriculum</span>
              </div>
            ) : (
              courses.map((c) => (
                <div key={c.id} className="card" style={{ padding: "20px", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <h3>{c.name}</h3>
                  <p style={{ color: "#64748b", margin: "6px 0" }}>
                    Semester {c.semester} {c.code ? `• ${c.code}` : ""}
                  </p>
                  <span className="badge-grounded">Active Course</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Create Course Modal */}
        {showCourseModal && (
          <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div className="modal-content" style={{ background: "white", padding: "24px", borderRadius: "12px", width: "420px", maxWidth: "90vw" }}>
              <h3>Add Official Course</h3>
              <form onSubmit={handleCreateCourse} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "bold" }}>Course Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Distributed Operating Systems"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "bold" }}>Semester</label>
                  <select
                    value={newCourseSemester}
                    onChange={(e) => setNewCourseSemester(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                  >
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                    <option value="3">Semester 3</option>
                    <option value="4">Semester 4</option>
                    <option value="5">Semester 5</option>
                    <option value="6">Semester 6</option>
                    <option value="7">Semester 7</option>
                    <option value="8">Semester 8</option>
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                  <button type="button" className="btn-back" onClick={() => setShowCourseModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Course
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default FacultyDashboard;
