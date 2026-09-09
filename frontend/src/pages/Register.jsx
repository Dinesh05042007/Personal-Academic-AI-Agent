import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabase";
import api from "../services/api";

function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("Creating student account...");

    try {
      // 1. Attempt direct Supabase browser sign-up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "student"
          }
        }
      });

      if (!error && data?.user) {
        setMessage("Registration successful! Redirecting to login...");
        setTimeout(() => navigate("/login"), 1500);
        return;
      }

      // 2. Fallback to server-side backend registration endpoint
      const res = await api.post("/api/auth/register", {
        email,
        password,
        full_name: fullName
      });

      if (res.data && (res.data.user || res.data.message)) {
        setMessage("Registration successful! Redirecting to login...");
        setTimeout(() => navigate("/login"), 1500);
        return;
      }

      setMessage("Registration notification: " + (error?.message || "Please proceed to sign in."));
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || "Registration completed. Proceed to sign in.";
      setMessage(errMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand-badge">🎓 Personal Academic AI</div>
        <h2>Create Account</h2>
        <p className="subtitle">Build your personal course-grounded AI knowledge base</p>

        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              placeholder="e.g. Dinesh Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

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
              placeholder="Choose a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Registering..." : "Create Account"}
          </button>
        </form>

        {message && <div className="status-alert">{message}</div>}

        <p className="auth-footer">
          Already registered? <Link to="/login">Sign in here</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
