import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { uploadResourceFile } from "../services/api";

function Resources() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const subjectId = searchParams.get("subject") || "subj_os";

  const [file, setFile] = useState(null);
  const [unit, setUnit] = useState("Unit 1");
  const [resourceName, setResourceName] = useState("");
  const [textContent, setTextContent] = useState("");
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload(e) {
    e.preventDefault();

    if (!file && !textContent.trim()) {
      alert("Please select a PDF file or paste text notes.");
      return;
    }

    if (file) {
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        alert("Please upload a valid PDF file.");
        return;
      }

      const maxSize = 20 * 1024 * 1024; // 20 MB
      if (file.size > maxSize) {
        alert("PDF file must be smaller than 20 MB.");
        return;
      }
    }

    setIsUploading(true);
    setStatus("🟡 Processing & vectorizing document into your private knowledge base...");

    try {
      const formData = new FormData();
      formData.append("subject_id", subjectId);
      formData.append("course_id", "course_btech_cse");
      formData.append("unit", unit);
      formData.append("resource_name", resourceName || file?.name || "Uploaded_Lecture_Notes.pdf");

      if (file) {
        formData.append("file", file);
      } else {
        formData.append("text_content", textContent);
      }

      await uploadResourceFile(formData);
      setStatus("🟢 Completed! Your course material has been indexed and is now searchable by the AI Agent.");
      setTimeout(() => {
        navigate(`/subject/${subjectId}`);
      }, 1800);
    } catch (err) {
      setStatus("🔴 Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="dashboard-layout">
      <header className="app-header">
        <div className="header-brand">
          <button className="btn-back" onClick={() => navigate(`/subject/${subjectId}`)}>← Back to Subject</button>
          <h2>Upload Course Material</h2>
        </div>
      </header>

      <main className="dashboard-main" style={{ maxWidth: "600px" }}>
        <div className="course-card">
          <div className="section-title">
            <h3>Add Learning Resource</h3>
          </div>
          <p className="subtitle">
            Upload a syllabus PDF, lecture PPT/notes, or assignment to ground the AI in your exact curriculum.
          </p>

          <form onSubmit={handleUpload}>
            <div className="form-group">
              <label>Target Unit / Topic</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. Unit 2 - Process Scheduling"
                required
              />
            </div>

            <div className="form-group">
              <label>Resource Title</label>
              <input
                type="text"
                value={resourceName}
                onChange={(e) => setResourceName(e.target.value)}
                placeholder="e.g. OS_Unit_2_Lecture_Notes.pdf"
              />
            </div>

            <div className="form-group">
              <label>Select PDF File (Max 20MB)</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </div>

            <div className="form-divider"><span>OR PASTE TEXT NOTES DIRECTLY</span></div>

            <div className="form-group">
              <textarea
                rows={5}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste revision notes or lecture transcript here..."
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isUploading}>
              {isUploading ? "Extracting & Embedding..." : "Upload & Vectorize PDF"}
            </button>
          </form>

          {status && <div className="status-alert" style={{ marginTop: "16px" }}>{status}</div>}
        </div>
      </main>
    </div>
  );
}

export default Resources;
