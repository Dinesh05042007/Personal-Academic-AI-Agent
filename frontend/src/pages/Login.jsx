import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabase";
import { getMyProfile } from "../services/profileService";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("Authenticating...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setMessage("Supabase error: " + error.message + ". You can use quick demo login below.");
        setLoading(false);
        return;
      }

      if (data?.session?.access_token) {
        localStorage.setItem("academic_ai_token", data.session.access_token);
      }

      const profile = await getMyProfile();
      const role = profile?.role || "student";
      localStorage.setItem("academic_user_role", role);

      if (role === "admin") navigate("/admin");
      else if (role === "faculty") navigate("/faculty");
      else navigate("/dashboard");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin(token, name, role) {
    localStorage.setItem("academic_ai_token", token);
    localStorage.setItem("academic_student_name", name);
    localStorage.setItem("academic_user_role", role);

    if (role === "admin") navigate("/admin");
    else if (role === "faculty") navigate("/faculty");
    else navigate("/dashboard");
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand-badge">🎓 Personal Academic AI</div>
        <h2>University Portal Login</h2>
        <p className="subtitle">Sign in to access your course materials, AI tutor, or department portal</p>

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label>University Email</label>
            <input
              type="email"
              placeholder="e.g. dinesh@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Signing in..." : "Login to Portal"}
          </button>
        </form>

        {message && <div className="status-alert">{message}</div>}

        <div className="divider"><span>OR QUICK EVALUATION ACCESS</span></div>

        <div className="demo-actions" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleDemoLogin("token_student_A", "Dinesh (Student)", "student")}
          >
            👨‍🎓 Student Portal (Dinesh)
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleDemoLogin("token_faculty_sharma", "Dr. Sharma (Faculty)", "faculty")}
          >
            👨‍🏫 Faculty Portal (Dr. Sharma)
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleDemoLogin("token_admin_dean", "Dean Academic (Admin)", "admin")}
          >
            ⚙️ Administrator Portal (Dean)
          </button>
        </div>

        <p className="auth-footer" style={{ marginTop: "16px" }}>
          Don't have an account? <Link to="/register">Create Student Account</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
