import { supabase } from "./supabase";

export async function getCurrentUser() {
  try {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (user) return user;
  } catch {
    // Continue to fallback
  }

  const localName = localStorage.getItem("academic_student_name") || "Dinesh";
  const localId = localStorage.getItem("academic_student_id") || "student_001";
  return {
    id: localId,
    email: `${localName.toLowerCase().replace(/[^a-z0-9]/g, "")}@university.edu`,
    user_metadata: { full_name: localName }
  };
}
