import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../services/supabase";
import { getMyProfile } from "../services/profileService";

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(localStorage.getItem("academic_user_role") || "student");

  useEffect(() => {
    async function loadRole() {
      try {
        const profile = await getMyProfile();
        if (profile?.role) {
          setRole(profile.role);
          localStorage.setItem("academic_user_role", profile.role);
        }
      } catch {
        // Fallback to student
      }
    }
    loadRole();
  }, []);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign out error:", err);
    }
    localStorage.removeItem("academic_ai_token");
    localStorage.removeItem("academic_student_name");
    localStorage.removeItem("academic_student_id");
    localStorage.removeItem("academic_user_role");
    navigate("/login");
  }

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>🎓 Academic AI</h2>
        <span className="sidebar-sub">
          {role === "admin" ? "⚙️ Administrator" : role === "faculty" ? "👨‍🏫 Faculty Portal" : "Curriculum Grounded"}
        </span>
      </div>

      <nav>
        {role === "admin" ? (
          <>
            <Link to="/admin" className={isActive("/admin") ? "active" : ""}>
              📊 Dashboard
            </Link>
            <Link to="/admin" className={isActive("/admin/users") ? "active" : ""}>
              👥 Users
            </Link>
            <Link to="/faculty" className={isActive("/faculty") ? "active" : ""}>
              📚 Courses
            </Link>
            <Link to="/admin" className={isActive("/admin/analytics") ? "active" : ""}>
              📊 Analytics
            </Link>
          </>
        ) : role === "faculty" ? (
          <>
            <Link to="/faculty" className={isActive("/faculty") ? "active" : ""}>
              📊 Dashboard
            </Link>
            <Link to="/faculty" className={isActive("/faculty/courses") ? "active" : ""}>
              📚 Courses
            </Link>
            <Link to="/resources" className={isActive("/resources") ? "active" : ""}>
              📄 Resources
            </Link>
            <Link to="/faculty" className={isActive("/faculty/analytics") ? "active" : ""}>
              📊 Analytics
            </Link>
          </>
        ) : (
          <>
            <Link to="/dashboard" className={isActive("/dashboard") ? "active" : ""}>
              📊 Dashboard
            </Link>
            <Link to="/chat" className={isActive("/chat") ? "active" : ""}>
              🤖 AI Tutor
            </Link>
            <Link to="/dashboard" className={isActive("/course") ? "active" : ""}>
              📚 My Courses
            </Link>
            <Link to="/resources" className={isActive("/resources") ? "active" : ""}>
              📄 Resources
            </Link>
          </>
        )}
      </nav>

      <button className="btn-logout" onClick={handleLogout}>
        🚪 Logout
      </button>
    </aside>
  );
}

export default Sidebar;
