import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import CourseCard from "../components/CourseCard";
import ResourceCard from "../components/ResourceCard";
import { fetchCourses, fetchSubjects, fetchResources } from "../services/api";
import { getCurrentUser } from "../services/auth";

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [studentName, setStudentName] = useState("Dinesh");
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const u = await getCurrentUser();
        setUser(u);
        const name = u?.user_metadata?.full_name || localStorage.getItem("academic_student_name") || "Dinesh";
        setStudentName(name);

        const c = await fetchCourses();
        setCourses(c);
        const s = await fetchSubjects();
        setSubjects(s);
        const r = await fetchResources();
        setResources(r);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        {/* Welcome Header */}
        <section className="dashboard-hero" style={{ marginBottom: "28px" }}>
          <div>
            <h2>Welcome back, {studentName} 👋</h2>
            <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
              {user?.email || "Student Account"} • Semester 3 B.Tech CSE
            </p>
          </div>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => navigate("/chat")}>
              🤖 Ask AI Tutor
            </button>
            <button className="btn-secondary" onClick={() => navigate("/course")}>
              📚 View Courses
            </button>
          </div>
        </section>

        {/* 5 Academic Study Modes */}
        <section className="dashboard-section" style={{ marginBottom: "32px" }}>
          <div className="section-title">
            <h3>🎯 5 Core AI Study Modes</h3>
            <span className="badge">Curriculum Grounded</span>
          </div>
          <div className="study-modes-grid">
            <div
              className="study-mode-card"
              onClick={() => navigate("/chat?mode=learn")}
            >
              <div className="study-mode-icon">📚</div>
              <h4>Learn Mode</h4>
              <p>Teacher-style conceptual breakdown using real-world analogies and zero technical jargon.</p>
            </div>

            <div
              className="study-mode-card"
              onClick={() => navigate("/chat?mode=exam")}
            >
              <div className="study-mode-icon">📝</div>
              <h4>Exam Mode</h4>
              <p>Structured university model answers with 10-mark vs 2-mark automatic format detection.</p>
            </div>

            <div
              className="study-mode-card"
              onClick={() => navigate("/chat?mode=summary")}
            >
              <div className="study-mode-icon">📄</div>
              <h4>Summary Mode</h4>
              <p>Chapter-level revision summary with core concept checklists and likely exam questions.</p>
            </div>

            <div
              className="study-mode-card"
              onClick={() => navigate("/chat?mode=quiz")}
            >
              <div className="study-mode-icon">🧠</div>
              <h4>Quiz Mode</h4>
              <p>Self-assessment multiple-choice practice questions generated directly from your notes.</p>
            </div>

            <div
              className="study-mode-card"
              onClick={() => navigate("/chat?mode=find")}
            >
              <div className="study-mode-icon">🔎</div>
              <h4>Find in Notes</h4>
              <p>Pinpoint exact PDF files, page numbers, and verified quotes for any topic in seconds.</p>
            </div>
          </div>
        </section>

        {/* Your Courses */}
        <section className="dashboard-section" style={{ marginBottom: "32px" }}>
          <div className="section-title">
            <h3>Your Courses</h3>
            <span className="badge">Enrolled</span>
          </div>

          {loading ? (
            <p>Loading course data...</p>
          ) : (
            <div className="course-grid">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onClick={() => navigate(`/course/${course.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Enrolled Subjects */}
        <section className="dashboard-section" style={{ marginBottom: "32px" }}>
          <div className="section-title">
            <h3>Course Subjects</h3>
            <span className="badge">Semester 3</span>
          </div>

          <div className="subjects-grid">
            {subjects.map((subj) => {
              const subjResources = resources.filter((r) => r.subject_id === subj.id);
              return (
                <div key={subj.id} className="subject-card">
                  <div>
                    <span className="subject-code">{subj.code}</span>
                    <h4 style={{ margin: "6px 0" }}>{subj.name}</h4>
                    <p className="resource-count">
                      📄 {subjResources.length > 0 ? `${subjResources.length} Materials Indexed` : "Course Material Active"}
                    </p>
                  </div>
                  <div className="subject-actions" style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                    <button
                      className="btn-sm btn-primary"
                      onClick={() => navigate(`/subject/${subj.id}`)}
                    >
                      Open Subject
                    </button>
                    <button
                      className="btn-sm btn-outline"
                      onClick={() => navigate(`/chat?subject=${subj.id}&name=${encodeURIComponent(subj.name)}`)}
                    >
                      Ask AI
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent Resources */}
        <section className="dashboard-section">
          <div className="section-title">
            <h3>Recent Academic Resources</h3>
          </div>
          {resources.slice(0, 3).map((res) => (
            <ResourceCard key={res.id} resource={res} />
          ))}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
