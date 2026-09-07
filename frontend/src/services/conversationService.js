import { supabase } from "./supabase";
import api from "./api";

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

  const res = await api.post("/api/chat/conversations", {
    subject_id: subjectId,
    title,
  });
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
    ? `/api/chat/conversations?subject_id=${encodeURIComponent(subjectId)}`
    : "/api/chat/conversations";
  const res = await api.get(url);
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

  const res = await api.post("/api/chat/messages", {
    conversation_id: conversationId,
    role,
    content,
    sources,
  });
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

  const res = await api.get(`/api/chat/messages?conversation_id=${encodeURIComponent(conversationId)}`);
  return res.data.messages || [];
}
