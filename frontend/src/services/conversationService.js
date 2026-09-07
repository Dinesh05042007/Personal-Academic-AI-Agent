import { supabase } from "./supabase";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function getAuthHeaders() {
  const token = localStorage.getItem("academic_ai_token") || "token_student_A";
  return { Authorization: "Bearer " + token };
}

export async function createConversation(subjectId, title = "New Chat") {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && user.id) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          student_id: user.id,
          subject_id: subjectId,
          title,
        })
        .select()
        .single();

      if (!error && data) return data;
    }
  } catch {
    // Fallback to Express backend
  }

  const res = await axios.post(
    API_BASE + "/api/chat/conversations",
    { subject_id: subjectId, title },
    { headers: getAuthHeaders() }
  );
  return res.data.conversation;
}

export async function getMyConversations(subjectId) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && user.id) {
      let query = supabase
        .from("conversations")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (subjectId) {
        query = query.eq("subject_id", subjectId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
    }
  } catch {
    // Fallback to Express backend
  }

  const url = subjectId
    ? API_BASE + "/api/chat/conversations?subject_id=" + subjectId
    : API_BASE + "/api/chat/conversations";
  const res = await axios.get(url, { headers: getAuthHeaders() });
  return res.data.conversations || [];
}

export async function saveMessage(conversationId, role, content, sources = []) {
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role,
        content,
        sources,
      })
      .select()
      .single();

    if (!error && data) return data;
  } catch {
    // Fallback to Express backend
  }

  const res = await axios.post(
    API_BASE + "/api/chat/messages",
    { conversation_id: conversationId, role, content, sources },
    { headers: getAuthHeaders() }
  );
  return res.data;
}

export async function getMessages(conversationId) {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) return data;
  } catch {
    // Fallback to Express backend
  }

  const res = await axios.get(
    API_BASE + "/api/chat/messages?conversation_id=" + conversationId,
    { headers: getAuthHeaders() }
  );
  return res.data.messages || [];
}
