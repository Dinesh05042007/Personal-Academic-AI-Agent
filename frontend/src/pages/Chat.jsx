import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchSubjects, sendAgentMessage, clearChatHistory } from "../services/api";
import {
  createConversation,
  getMyConversations,
  saveMessage,
  getMessages
} from "../services/conversationService";
import MessageBubble from "../components/MessageBubble";

function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const courseId = queryParams.get("course") || "course_btech_cse";
  const initialSubject = queryParams.get("subject") || "subj_os";
  const initialSubjectName = queryParams.get("name") || "Operating Systems";
  const initialMode = (queryParams.get("mode") || "auto").toLowerCase();
  const initialConvId = queryParams.get("conversation") || null;

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(initialSubject);
  const [selectedSubjectName, setSelectedSubjectName] = useState(initialSubjectName);
  const [mode, setMode] = useState(initialMode); // auto, learn, exam, summary, quiz, find, study_plan
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");

  // Multi-conversation state (Step 596-606 & Step 617)
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(initialConvId);

  const MODES = [
    { id: "auto", label: "🎯 Auto Detect", title: "Automatically detect intent (Learn, Exam, Summary, Quiz, Find) and syllabus unit from your query" },
    { id: "learn", label: "📚 Learn", title: "Teach a topic simply like a classroom teacher" },
    { id: "exam", label: "📝 Exam", title: "Create structured exam-ready answers suitable for mark level" },
    { id: "summary", label: "📄 Summary", title: "Summarize uploaded course material" },
    { id: "quiz", label: "🧠 Quiz", title: "Generate practice questions directly from your notes" },
    { id: "find", label: "🔎 Find", title: "Find where a topic appears with exact page numbers" },
    { id: "study_plan", label: "📅 Study Plan", title: "Generate a day-by-day revision schedule" }
  ];

  const QUICK_PROMPTS = {
    auto: [
      "Explain dual-mode operation for 10 marks",
      "Explain process states like I'm a beginner",
      "Summarize Unit 1 Process Management",
      "Quiz me on CPU scheduling",
      "Where is privileged mode described?"
    ],
    learn: [
      "Explain dual-mode operation simply with an analogy",
      "Explain process states like I'm a beginner",
      "Why do we need context switching?"
    ],
    exam: [
      "Explain dual-mode operation for 10 marks",
      "Explain process scheduling for 2 marks",
      "10-mark answer on deadlock conditions"
    ],
    summary: [
      "Summarize Unit 1 Process Management",
      "Overview of Unit 1 core concepts",
      "Key definitions and principles in Unit 1"
    ],
    quiz: [
      "Quiz me on Unit 1 core concepts",
      "Quiz me on CPU scheduling and process states",
      "Test my knowledge on Dual-Mode Operation"
    ],
    find: [
      "Where is privileged mode described?",
      "Where is process scheduling discussed?",
      "Where is context switching defined?"
    ],
    study_plan: [
      "5-day revision schedule for Unit 1",
      "3-day exam study timetable for OS",
      "Weekend cram schedule for Unit 1"
    ]
  };

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hello! I am your Personal Academic AI Agent for ${selectedSubjectName}. I am strictly grounded in your semester notes, PDFs, and curriculum resources. Choose any of the 5 AI modes above: ask for a classroom breakdown in Learn mode, request a 10-mark or 2-mark answer in Exam mode, summarize with Summary mode, practice with Quiz mode, or locate references with Find mode!`,
      sources: []
    }
  ]);

  const messagesEndRef = useRef(null);

  // Load subject list on mount
  useEffect(() => {
    async function loadSubjs() {
      const s = await fetchSubjects();
      setSubjects(s);
    }
    loadSubjs();
  }, []);

  const loadMessagesForConversation = useCallback(async (cId) => {
    if (!cId) return;
    try {
      const stored = await getMessages(cId);
      if (stored && stored.length > 0) {
        setMessages(
          stored.map((m) => ({
            role: m.role === "student" ? "user" : m.role,
            content: m.content,
            sources: m.sources || []
          }))
        );
      } else {
        setMessages([
          {
            role: "assistant",
            content: `Connected to conversation thread. Ask any question from your ${selectedSubjectName} notes.`,
            sources: []
          }
        ]);
      }
    } catch (err) {
      console.warn("Could not load stored messages:", err.message);
    }
  }, [selectedSubjectName]);

  // Load persistent conversations for selected subject
  useEffect(() => {
    let isCurrent = true;
    async function loadSubjectConversations() {
      try {
        const convs = await getMyConversations(selectedSubject);
        if (!isCurrent) return;
        setConversations(convs || []);

        let activeId = conversationId;
        if (convs && convs.length > 0) {
          const matched = convs.find((c) => c.id === activeId);
          if (!matched) {
            activeId = convs[0].id;
          }
          setConversationId(activeId);
          await loadMessagesForConversation(activeId);
        } else {
          // Auto-create initial conversation thread
          const newConv = await createConversation(selectedSubject, `${selectedSubjectName} Chat`);
          if (!isCurrent) return;
          if (newConv && newConv.id) {
            setConversationId(newConv.id);
            setConversations([newConv]);
            setMessages([
              {
                role: "assistant",
                content: `Welcome to your academic chat for ${selectedSubjectName}. How can I assist you with your notes today?`,
                sources: []
              }
            ]);
          }
        }
      } catch (err) {
        console.warn("Failed to load conversations:", err.message);
      }
    }
    loadSubjectConversations();
    return () => {
      isCurrent = false;
    };
  }, [selectedSubject, selectedSubjectName, conversationId, loadMessagesForConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSelectConversation(cId) {
    setConversationId(cId);
    await loadMessagesForConversation(cId);
  }

  async function handleNewChat() {
    try {
      const title = `${selectedSubjectName} Chat ${conversations.length + 1}`;
      const newConv = await createConversation(selectedSubject, title);
      if (newConv && newConv.id) {
        setConversations((prev) => [newConv, ...prev]);
        setConversationId(newConv.id);
        setMessages([
          {
            role: "assistant",
            content: `Started new conversation thread: "${title}". Ask me anything from your ${selectedSubjectName} notes in any AI mode!`,
            sources: []
          }
        ]);
      }
    } catch (err) {
      console.error("Error creating new chat:", err);
    }
  }

  async function handleSubjectChange(id) {
    setSelectedSubject(id);
    const found = subjects.find((s) => s.id === id);
    const name = found ? found.name : "Operating Systems";
    setSelectedSubjectName(name);
    setConversationId(null);
  }

  async function handleClearHistory() {
    if (conversationId) {
      await clearChatHistory(conversationId);
    }
    setMessages([
      {
        role: "assistant",
        content: `Chat history cleared. What topic would you like to explore in ${selectedSubjectName}?`,
        sources: []
      }
    ]);
  }

  async function handleSend(e) {
    e.preventDefault();
    const queryText = question.trim();
    if (!queryText || isLoading) return;

    const activeConvId = conversationId || ("conv_" + selectedSubject);

    // 1. Display user message immediately
    const userMsg = { role: "user", content: queryText };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsLoading(true);
    setLoadingPhase("🤖 AI is searching your academic resources...");

    // 2. Persist student message to database (Step 603)
    try {
      await saveMessage(activeConvId, "student", queryText, []);
    } catch (saveErr) {
      console.warn("Failed to persist user message:", saveErr.message);
    }

    const phaseTimer = setTimeout(() => {
      setLoadingPhase("🤖 AI is preparing your answer...");
    }, 1200);

    try {
      // 3. Send query to AI Agent / n8n orchestrator
      const res = await sendAgentMessage({
        question: queryText,
        conversation_id: activeConvId,
        subject_id: selectedSubject,
        course_id: courseId,
        mode: mode
      });

      const aiMsg = {
        role: "assistant",
        content: res.answer,
        sources: res.sources || [],
        intent: res.intent,
        mode: res.mode,
        detected_unit: res.detected_unit
      };

      // 4. Persist AI answer with sources to database (Step 604)
      try {
        await saveMessage(activeConvId, "ai", res.answer, res.sources || []);
      } catch (saveAiErr) {
        console.warn("Failed to persist AI message:", saveAiErr.message);
      }

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an issue connecting to the AI Agent: " + err.message,
          sources: []
        }
      ]);
    } finally {
      clearTimeout(phaseTimer);
      setIsLoading(false);
      setLoadingPhase("");
    }
  }

  function handleQuickPrompt(promptText) {
    setQuestion(promptText);
  }

  const activePrompts = QUICK_PROMPTS[mode] || QUICK_PROMPTS.learn;

  const placeholders = {
    auto: `Ask naturally (e.g. "10 marks on deadlock", "Explain Unit 1", "Quiz me on OS")...`,
    learn: `Ask anything from your ${selectedSubjectName} notes (e.g. "Explain deadlock")...`,
    exam: `Enter topic for an exam answer (e.g. "Explain process scheduling for 10 marks")...`,
    summary: `Enter unit to summarize (e.g. "Summarize Unit 1")...`,
    quiz: `Enter topic for practice quiz (e.g. "Quiz me on Unit 1")...`,
    find: `Enter topic to locate in notes (e.g. "Where is deadlock discussed?")...`,
    study_plan: `Enter timeline (e.g. "5-day revision schedule for Unit 1")...`
  };

  return (
    <div className="chat-container-split">
      {/* Conversation Sidebar (Step 617) */}
      <aside className="chat-history-sidebar">
        <div className="chat-history-header">
          <h3>💬 Chat Threads</h3>
          <button className="btn-back" style={{ padding: "4px 8px", fontSize: "12px" }} onClick={() => navigate("/dashboard")}>
            ← Dashboard
          </button>
        </div>

        <button className="btn-new-chat" onClick={handleNewChat}>
          ➕ New Chat
        </button>

        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "8px" }}>
              No chats yet. Start a new one!
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`conversation-item ${conversationId === c.id ? "active" : ""}`}
                onClick={() => handleSelectConversation(c.id)}
              >
                <span className="conv-title">💬 {c.title || "Academic Chat"}</span>
                <span className="conv-date">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString() : "Active"}
                </span>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Panel */}
      <main className="chat-main-panel chat-layout">
        {/* Top Bar */}
        <header className="chat-header">
          <div className="chat-header-left">
            <div className="chat-title">
              <h2>🧠 {selectedSubjectName} — AI Academic Tutor</h2>
              <span className="badge-grounded">🔒 Grounded in your notes</span>
            </div>
          </div>

          {/* Controls */}
          <div className="chat-controls">
            <select
              value={selectedSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="subject-select"
              disabled={isLoading}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-clear-chat"
              onClick={handleClearHistory}
              disabled={isLoading}
              title="Clear conversation history for this thread"
            >
              🧹 Clear Chat
            </button>
          </div>
        </header>

        {/* 5 AI Modes Ribbon */}
        <div className="mode-ribbon-container">
          <span className="mode-ribbon-label">AI Modes:</span>
          <div className="mode-ribbon">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`mode-btn ${mode === m.id ? "active" : ""}`}
                onClick={() => setMode(m.id)}
                disabled={isLoading}
                title={m.title}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Current Mode Indicator */}
        <div className="current-mode-status">
          <span>
            Current mode: <strong>{MODES.find((m) => m.id === mode)?.label || mode}</strong>
          </span>
        </div>

        {/* Message Feed */}
        <div className="chat-feed">
          {messages.map((msg, index) => (
            <MessageBubble key={index} message={msg} />
          ))}

          {isLoading && (
            <div className="message-row assistant-row">
              <div className="message-bubble assistant-bubble loading-bubble">
                <span className="dot-pulse">{loadingPhase || "🤖 AI is searching your academic resources..."}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Prompts */}
        <div className="quick-prompts">
          <span className="quick-label">Try asking ({MODES.find((m) => m.id === mode)?.label}):</span>
          {activePrompts.map((promptText, pIdx) => (
            <button
              key={pIdx}
              className="quick-chip"
              onClick={() => handleQuickPrompt(promptText)}
            >
              "{promptText}"
            </button>
          ))}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="chat-input-form">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={placeholders[mode] || `Ask anything from your ${selectedSubjectName} notes...`}
            className="chat-input"
            disabled={isLoading}
          />
          <button type="submit" className="btn-send" disabled={isLoading || !question.trim()}>
            {isLoading ? "Searching..." : "Send ➤"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default Chat;
