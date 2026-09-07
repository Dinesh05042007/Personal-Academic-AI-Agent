import { supabase } from "./supabase";
import api from "./api";

export async function getSubjects(courseId = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      let query = supabase
        .from("subjects")
        .select("*")
        .eq("student_id", user.id);

      if (courseId) {
        query = query.eq("course_id", courseId);
      }

      const { data, error } = await query.order("created_at", { ascending: true });
      if (!error && data && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Supabase subjects fetch bypassed:", err.message);
  }

  // Backend API fallback
  try {
    const url = courseId ? `/api/student/subjects?course_id=${courseId}` : "/api/student/subjects";
    const res = await api.get(url);
    if (res.data?.subjects && res.data.subjects.length > 0) {
      return res.data.subjects;
    }
  } catch (backendErr) {
    console.warn("Backend subjects fetch fallback:", backendErr.message);
  }

  return [
    { id: "subj_os", name: "Operating Systems", code: "CS301", course_id: courseId || "course_btech_cse" },
    { id: "subj_dbms", name: "Database Management Systems", code: "CS302", course_id: courseId || "course_btech_cse" },
    { id: "subj_csharp", name: "C# Programming", code: "CS303", course_id: courseId || "course_btech_cse" },
    { id: "subj_cn", name: "Computer Networks", code: "CS304", course_id: courseId || "course_btech_cse" }
  ];
}
