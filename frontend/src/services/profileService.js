import { supabase } from "./supabase";
import api from "./api";

/**
 * Stage 19: Profile & Role Service (Step 650)
 * Retrieves authenticated user identity and role from backend /api/auth/me or Supabase.
 */
export async function getMyProfile() {
  try {
    const res = await api.get("/api/auth/me");
    if (res.data?.user) {
      return res.data.user;
    }
  } catch (apiErr) {
    console.warn("Backend auth lookup skipped:", apiErr.message);
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        return data;
      }
      return {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || "Student",
        role: user.user_metadata?.role || "student"
      };
    }
  } catch (err) {
    console.warn("Supabase profile lookup error:", err.message);
  }

  // Local fallback
  return {
    id: localStorage.getItem("academic_student_id") || "student_001",
    name: localStorage.getItem("academic_student_name") || "Student",
    email: "student@academic.edu",
    role: "student"
  };
}

/**
 * Dedicated Student Profile Operations
 */
export async function fetchStudentProfile() {
  try {
    const res = await api.get("/api/student/profile");
    if (res.data?.profile) {
      return res.data.profile;
    }
  } catch (err) {
    console.warn("Failed to fetch profile from API, falling back:", err.message);
  }

  // Fallback to getMyProfile
  const base = await getMyProfile();
  return {
    id: base.id,
    student_id: base.student_id || base.id,
    name: base.name || "",
    email: base.email || "",
    department: base.department || "",
    year: base.year || "",
    semester: base.semester || null,
    register_number: base.register_number || "",
    bio: base.bio || "",
    avatar_url: base.avatar_url || null,
    role: base.role || "student"
  };
}

export async function updateStudentProfile(profileData) {
  const res = await api.put("/api/student/profile", profileData);
  return res.data.profile;
}

export async function uploadProfilePhoto(photoFile) {
  const formData = new FormData();
  formData.append("photo", photoFile);
  const res = await api.post("/api/student/profile/photo", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return res.data;
}

export async function deleteProfilePhoto() {
  const res = await api.delete("/api/student/profile/photo");
  return res.data;
}
