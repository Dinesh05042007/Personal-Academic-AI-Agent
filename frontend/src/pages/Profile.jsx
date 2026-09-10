import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import {
  fetchStudentProfile,
  updateStudentProfile,
  uploadProfilePhoto,
  deleteProfilePhoto
} from "../services/profileService";

function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    department: "",
    year: "",
    semester: null,
    register_number: "",
    bio: "",
    avatar_url: null,
    role: "student",
    created_at: null
  });

  const [form, setForm] = useState({
    name: "",
    department: "",
    year: "",
    semester: "",
    register_number: "",
    bio: ""
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const data = await fetchStudentProfile();
        setProfile(data);
        setForm({
          name: data.name || "",
          department: data.department || "",
          year: data.year || "",
          semester: data.semester !== null && data.semester !== undefined ? String(data.semester) : "",
          register_number: data.register_number || "",
          bio: data.bio || ""
        });
      } catch (err) {
        setStatusMessage({ type: "error", text: "Failed to load profile: " + err.message });
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  function handleInputChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate format
    const validExtensions = ["image/jpeg", "image/png", "image/webp"];
    if (!validExtensions.includes(file.type)) {
      setStatusMessage({
        type: "error",
        text: "Unsupported image format. Allowed formats: JPG, PNG, WEBP."
      });
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({
        type: "error",
        text: "File size exceeds 5MB limit. Please choose a smaller photo."
      });
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setStatusMessage(null);
  }

  function handleCancelPhoto() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSavePhoto() {
    if (!selectedFile) return;
    try {
      setPhotoUploading(true);
      setStatusMessage(null);
      const res = await uploadProfilePhoto(selectedFile);
      setProfile((prev) => ({ ...prev, avatar_url: res.avatar_url }));
      setStatusMessage({ type: "success", text: "Profile photo updated successfully!" });
      handleCancelPhoto();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.response?.data?.error || "Failed to upload photo: " + err.message
      });
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleRemovePhoto() {
    if (!window.confirm("Are you sure you want to remove your profile photo?")) return;
    try {
      setPhotoUploading(true);
      setStatusMessage(null);
      await deleteProfilePhoto();
      setProfile((prev) => ({ ...prev, avatar_url: null }));
      setStatusMessage({ type: "success", text: "Profile photo removed successfully." });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.response?.data?.error || "Failed to remove photo: " + err.message
      });
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setStatusMessage(null);
      const payload = {
        ...form,
        semester: form.semester ? parseInt(form.semester, 10) : null
      };
      const updated = await updateStudentProfile(payload);
      setProfile((prev) => ({ ...prev, ...updated }));
      if (form.name) {
        localStorage.setItem("academic_student_name", form.name);
      }
      setStatusMessage({ type: "success", text: "Profile details saved successfully!" });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.response?.data?.error || "Failed to update profile: " + err.message
      });
    } finally {
      setSaving(false);
    }
  }

  const getInitials = (name) => {
    if (!name) return "ST";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const displayAvatar = previewUrl || profile.avatar_url;

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        {/* Header */}
        <section className="dashboard-hero" style={{ marginBottom: "28px" }}>
          <div>
            <h2>Student Profile 👤</h2>
            <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
              View and manage your academic identity, degree program, and avatar.
            </p>
          </div>
          <div className="hero-buttons">
            <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
              ⬅️ Back to Dashboard
            </button>
          </div>
        </section>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`alert-banner ${statusMessage.type === "success" ? "alert-success" : "alert-error"}`}
            style={{
              padding: "14px 18px",
              borderRadius: "10px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: statusMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${statusMessage.type === "success" ? "#a7f3d0" : "#fecaca"}`,
              color: statusMessage.type === "success" ? "#065f46" : "#991b1b"
            }}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
                color: "inherit"
              }}
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <p>Loading student profile...</p>
          </div>
        ) : (
          <div className="profile-layout-grid" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "28px" }}>
            {/* Left Card: Avatar & Summary */}
            <div
              className="profile-card"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                boxShadow: "var(--shadow)"
              }}
            >
              {/* Circular Avatar */}
              <div
                style={{
                  position: "relative",
                  width: "130px",
                  height: "130px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "3px solid var(--primary)",
                  boxShadow: "0 6px 16px rgba(37, 99, 235, 0.2)",
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "18px"
                }}
              >
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt="Profile Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                      color: "#ffffff",
                      fontSize: "42px",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {getInitials(profile.name)}
                  </div>
                )}
              </div>

              {/* Photo Action Buttons */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />

              {previewUrl ? (
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px", width: "100%" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSavePhoto}
                    disabled={photoUploading}
                    style={{ flex: 1, padding: "8px 12px", fontSize: "13px" }}
                  >
                    {photoUploading ? "Uploading..." : "Save Photo"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCancelPhoto}
                    disabled={photoUploading}
                    style={{ padding: "8px 12px", fontSize: "13px" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginBottom: "16px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                    style={{ padding: "8px 14px", fontSize: "13px" }}
                  >
                    📷 Change Photo
                  </button>
                  {profile.avatar_url && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={photoUploading}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        fontSize: "12px",
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: "4px"
                      }}
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              )}

              <h3 style={{ margin: "4px 0 2px", fontSize: "18px" }}>{profile.name || "Student User"}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "16px" }}>
                {profile.email || "No email on record"}
              </p>

              <div
                style={{
                  width: "100%",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  textAlign: "left",
                  fontSize: "13px"
                }}
              >
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Student ID / Register:</span>
                  <strong>{profile.register_number || "Not specified"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Department:</span>
                  <strong>{profile.department || "Not specified"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Academic Year:</span>
                  <strong>
                    {profile.year ? `${profile.year}${profile.semester ? ` (Sem ${profile.semester})` : ""}` : "Not specified"}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Account Role:</span>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "3px",
                      padding: "3px 10px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      background: "#e0e7ff",
                      color: "#3730a3"
                    }}
                  >
                    {profile.role || "student"}
                  </span>
                </div>
                {profile.created_at && (
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block" }}>Member Since:</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                      {new Date(profile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Card: Editable Details Form */}
            <div
              className="profile-card"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                padding: "28px 32px",
                boxShadow: "var(--shadow)"
              }}
            >
              <h3 style={{ fontSize: "18px", marginBottom: "6px" }}>Academic Information</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
                Keep your academic credentials and degree details up to date.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "18px" }}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="form-group">
                    <label>University Email (Read-only)</label>
                    <input
                      type="email"
                      value={profile.email || ""}
                      disabled
                      style={{
                        background: "#f1f5f9",
                        color: "#64748b",
                        cursor: "not-allowed"
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "18px" }}>
                  <div className="form-group">
                    <label>Student ID / Register Number</label>
                    <input
                      type="text"
                      name="register_number"
                      value={form.register_number}
                      onChange={handleInputChange}
                      placeholder="e.g. 2026CS101"
                    />
                  </div>

                  <div className="form-group">
                    <label>Department / Degree</label>
                    <input
                      type="text"
                      name="department"
                      value={form.department}
                      onChange={handleInputChange}
                      placeholder="e.g. Computer Science & Engineering"
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "18px" }}>
                  <div className="form-group">
                    <label>Academic Year</label>
                    <select
                      name="year"
                      value={form.year}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Year</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                      <option value="Post-Graduate">Post-Graduate</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Semester</label>
                    <select
                      name="semester"
                      value={form.semester}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Semester</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={String(s)}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "24px" }}>
                  <label>Bio & Academic Focus</label>
                  <textarea
                    name="bio"
                    rows="4"
                    value={form.bio}
                    onChange={handleInputChange}
                    placeholder="Describe your research interests, coursework focus, or specialization..."
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={saving}
                    style={{ width: "auto", minWidth: "160px" }}
                  >
                    {saving ? "Saving Changes..." : "💾 Save Profile"}
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

export default Profile;
