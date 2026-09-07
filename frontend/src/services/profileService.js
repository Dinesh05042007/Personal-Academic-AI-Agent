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
    name: localStorage.getItem("academic_student_name") || "Dinesh",
    email: "dinesh@academic.edu",
    role: "student"
  };
}
