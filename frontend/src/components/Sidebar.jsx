import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../services/supabase";
import { fetchStudentProfile } from "../services/profileService";

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(localStorage.getItem("academic_user_role") || "student");
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await fetchStudentProfile();
        setUserProfile(profile);
        if (profile?.role) {
          setRole(profile.role);
          localStorage.setItem("academic_user_role", profile.role);
        }
      } catch {
        // Fallback to student
      }
    }
    loadProfile();
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
            <Link to="/profile" className={isActive("/profile") ? "active" : ""}>
              👤 Profile
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
            <Link to="/profile" className={isActive("/profile") ? "active" : ""}>
              👤 Profile
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
            <Link to="/profile" className={isActive("/profile") ? "active" : ""}>
              👤 Profile
            </Link>
          </>
        )}
      </nav>

      {/* User Profile Mini Chip */}
      <div
        className="sidebar-profile-chip"
        onClick={() => navigate("/profile")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 14px",
          margin: "12px 14px 4px",
          borderRadius: "10px",
          background: isActive("/profile") ? "rgba(37, 99, 235, 0.12)" : "rgba(0, 0, 0, 0.03)",
          border: "1px solid var(--border)",
          cursor: "pointer",
          transition: "all 0.2s"
        }}
        title="Go to Student Profile"
      >
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--primary)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: "bold",
            flexShrink: 0
          }}
        >
          {userProfile?.avatar_url ? (
            <img
              src={userProfile.avatar_url}
              alt="Avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            (userProfile?.name || "Student").slice(0, 2).toUpperCase()
          )}
        </div>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-main)" }}>
            {userProfile?.name || "Student User"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {userProfile?.register_number || "View Profile"}
          </div>
        </div>
      </div>

      <button className="btn-logout" onClick={handleLogout}>
        🚪 Logout
      </button>
    </aside>
  );
}

export default Sidebar;
