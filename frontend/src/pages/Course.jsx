import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getSubjects } from "../services/subjectService";

function Course() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSubjects(courseId);
        setSubjects(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <header className="dashboard-hero" style={{ marginBottom: "28px" }}>
          <div>
            <h2>📚 Course Curriculum & Subjects</h2>
            <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
              Enrolled subjects, syllabus units, and course learning resources.
            </p>
          </div>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => navigate("/chat")}>
              🤖 Ask AI Tutor
            </button>
          </div>
        </header>

        <section className="dashboard-section">
          <div className="section-title">
            <h3>Active Subjects</h3>
            <span className="badge">Semester 3</span>
          </div>

          {loading ? (
            <p>Loading subjects...</p>
          ) : subjects.length === 0 ? (
            <p>No subjects added yet.</p>
          ) : (
            <div className="subject-grid">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="subject-card"
                  onClick={() => navigate(`/subject/${subject.id}`)}
                >
                  <span className="subject-code">{subject.code}</span>
                  <h3 style={{ margin: "6px 0 10px" }}>{subject.name}</h3>
                  <span className="course-link">View resources & AI tools →</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Course;
