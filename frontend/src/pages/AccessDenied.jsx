import { useNavigate } from "react-router-dom";

function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "20px" }}>
      <main style={{ maxWidth: "480px", width: "100%", background: "white", padding: "32px", borderRadius: "16px", border: "1px solid #e2e8f0", textAlign: "center", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚫</div>
        <h1 style={{ fontSize: "24px", color: "#0f172a", marginBottom: "8px" }}>Access Denied</h1>
        <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
          You do not have permission to view this page. Elevated faculty or administrator credentials are required to access this portal.
        </p>
        <button
          className="btn-primary"
          onClick={() => navigate("/dashboard")}
          style={{ width: "100%", padding: "12px", fontSize: "14px" }}
        >
          Return to Student Dashboard
        </button>
      </main>
    </div>
  );
}

export default AccessDenied;
