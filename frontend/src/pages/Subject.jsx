import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import ResourceCard from "../components/ResourceCard";
import { fetchResources, fetchSubjects } from "../services/api";

function Subject() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [subjectName, setSubjectName] = useState(subjectId);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const subjects = await fetchSubjects();
        const current = subjects.find((s) => s.id === subjectId);
        if (current) setSubjectName(current.name);

        const res = await fetchResources(subjectId);
        setResources(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subjectId]);

  // Real-time status polling for in-progress documents (Step 559)
  useEffect(() => {
    let intervalId;
    const hasProcessing = resources.some((r) => r.processing_status === "processing");
    if (hasProcessing) {
      intervalId = setInterval(async () => {
        try {
          const updated = await fetchResources(subjectId);
          setResources(updated);
        } catch (err) {
          console.warn("Status polling error:", err.message);
        }
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [resources, subjectId]);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <header className="dashboard-hero" style={{ marginBottom: "28px" }}>
          <div>
            <h2>📖 {subjectName}</h2>
            <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
              Curriculum notes, textbook PDFs, assignments, and AI tutor tools.
            </p>
          </div>
          <div className="hero-buttons">
            <button
              className="btn-primary"
              onClick={() => navigate(`/resources?subject=${subjectId}`)}
            >
              + Upload Resource
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate(`/chat?subject=${subjectId}&name=${encodeURIComponent(subjectName)}`)}
            >
              🤖 Open AI Tutor
            </button>
          </div>
        </header>

        {/* AI Actions for Subject (Step 572-573) */}
        <section className="dashboard-section" style={{ marginBottom: "32px" }}>
          <div className="section-title">
            <h3>🤖 AI Study Actions for {subjectName}</h3>
            <span className="badge">5 AI Modes</span>
          </div>
          <div className="study-modes-grid">
            <div
              className="study-mode-card"
              onClick={() => navigate(`/chat?subject=${subjectId}&name=${encodeURIComponent(subjectName)}&mode=learn`)}
            >
              <div className="study-mode-icon">📚</div>
              <h4>Learn with AI</h4>
              <p>Break down difficult concepts with simple analogies and step-by-step logic.</p>
            </div>

            <div
              className="study-mode-card"
              onClick={() => navigate(`/chat?subject=${subjectId}&name=${encodeURIComponent(subjectName)}&mode=exam`)}
            >
              <div className="study-mode-icon">📝</div>
              <h4>Exam Mode</h4>
              <p>Generate 10-mark structured answers or concise 2-mark definitions.</p>
            </div>

            <div
              className="study-mode-card"
              onClick={() => navigate(`/chat?subject=${subjectId}&name=${encodeURIComponent(subjectName)}&mode=summary`)}
            >
              <div className="study-mode-icon">📄</div>
              <h4>Unit Summary</h4>
              <p>Synthesize complete unit revision summaries and concept checklists.</p>
            </div>

            <div
              className="study-mode-card"
              onClick={() => navigate(`/chat?subject=${subjectId}&name=${encodeURIComponent(subjectName)}&mode=quiz`)}
            >
              <div className="study-mode-icon">🧠</div>
              <h4>Quiz Me</h4>
              <p>Practice with interactive multiple-choice quizzes created from your notes.</p>
            </div>

            <div
              className="study-mode-card"
              onClick={() => navigate(`/chat?subject=${subjectId}&name=${encodeURIComponent(subjectName)}&mode=find`)}
            >
              <div className="study-mode-icon">🔎</div>
              <h4>Find in Notes</h4>
              <p>Locate exact documents, page numbers, and quoted snippets in seconds.</p>
            </div>
          </div>
        </section>

        {/* Subject Resources (Step 572) */}
        <section className="dashboard-section">
          <div className="section-title">
            <h3>📄 Uploaded Course Resources</h3>
            <span className="badge">{resources.length} Files</span>
          </div>

          {loading ? (
            <p>Loading course notes...</p>
          ) : resources.length === 0 ? (
            <div className="course-card" style={{ textAlign: "center", padding: "40px" }}>
              <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
                No resources uploaded for {subjectName} yet.
              </p>
              <button
                className="btn-primary"
                onClick={() => navigate(`/resources?subject=${subjectId}`)}
              >
                Upload First PDF
              </button>
            </div>
          ) : (
            <div>
              {resources.map((res) => (
                <ResourceCard key={res.id} resource={res} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Subject;
