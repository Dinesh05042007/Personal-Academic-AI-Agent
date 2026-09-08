const { GoogleGenerativeAI } = require("@google/generative-ai");
const { defaultRAGService, MISSING_INFO_FALLBACK } = require("./ragService");

const SYSTEM_PROMPT = `You are a Personal Academic AI Agent for one student.

Your job is to help the student understand their own academic resources in a simple, logical, and classroom-friendly way.

Priorities:
1. Grounding First: Base all academic answers strictly on the student's uploaded curriculum resources.
2. Direct Explanations: Explain concepts clearly and simply, adapting to the student's active subject and syllabus unit.
3. Step-by-Step Breakdown: Break complex technical mechanisms into numbered, logical steps.
4. Structured Exam Answers: For exam-related queries, format answers according to university marks (e.g., 10-mark or 2-mark), incorporating ASCII architecture diagrams where applicable.
5. Strict Anti-Hallucination: Never invent information, facts, or citations. If the required information is not found in the uploaded materials, state clearly: "${MISSING_INFO_FALLBACK}".
6. Verified Citations: Always provide the document name, syllabus unit, and page number for every cited concept. Never fabricate page numbers or sources.`;

function detectAdversarialInput(query) {
  if (!query || typeof query !== "string") return false;
  const adversarialPatterns = [
    /\bignore\s+(all\s+|above\s+|previous\s+)?instructions\b/i,
    /\bsystem\s+override\b/i,
    /\bdisregard\s+(all\s+|previous\s+)?guidelines\b/i,
    /\byou\s+are\s+no\s+longer\s+a\s+tutor\b/i,
    /\bact\s+as\s+an\s+unrestricted\b/i,
    /\btell\s+me\s+your\s+(internal\s+)?(system\s+)?prompt\b/i,
    /\bprint\s+(your\s+)?system\s+instructions\b/i
  ];
  return adversarialPatterns.some((pattern) => pattern.test(query));
}

/**
 * Stage 18: Syllabus Unit Extraction
 * Detects unit/module numbers from question text (e.g., "Unit 1", "Module 2", "Chapter 3")
 */
function detectUnit(question) {
  if (!question || typeof question !== "string") return null;
  const match = question.match(/\b(?:unit|module|chapter)\s*([0-9]+)\b/i);
  if (match && match[1]) {
    return `Unit ${match[1]}`;
  }
  return null;
}

/**
 * Stage 18: Autonomous Intent Classification
 * Maps student query or explicit user selection to one of 6 core intents:
 * learn, exam, summary, quiz, find, general (plus study_plan)
 */
function classifyIntent(question, explicitMode = null) {
  if (explicitMode && typeof explicitMode === "string") {
    const norm = explicitMode.trim().toLowerCase();
    if (norm !== "auto" && norm !== "") {
      return norm;
    }
  }

  if (!question || typeof question !== "string") {
    return "general";
  }

  const q = question.toLowerCase();

  // 1. Exam Intent
  if (/\b([0-9]+\s*[- ]?marks?|exam|marking|university question|model answer)\b/i.test(q)) {
    return "exam";
  }

  // 2. Summary Intent
  if (/\b(summarize|summary|overview|brief notes|chapter review|revision summary)\b/i.test(q)) {
    return "summary";
  }

  // 3. Quiz Intent
  if (/\b(quiz|quiz me|test me|test my knowledge|practice questions?|mcqs?)\b/i.test(q)) {
    return "quiz";
  }

  // 4. Find Intent
  if (/\b(where is|where are|which pdf|which document|locate|page number|where can i find|where does it appear)\b/i.test(q)) {
    return "find";
  }

  // 5. Study Plan Intent
  if (/\b(study plan|revision schedule|revision timetable|exam schedule|study timetable|revision plan)\b/i.test(q)) {
    return "study_plan";
  }

  // 6. Learn Intent
  if (/\b(explain|teach|beginner|simple|analogy|what is|what are|how does|how do|breakdown|understand)\b/i.test(q)) {
    return "learn";
  }

  return "general";
}

class AgentOrchestrator {
  constructor(ragService = defaultRAGService) {
    this.ragService = ragService;
    this.conversations = new Map(); // conversation_id -> { student_id, messages: [{ role, content, sources, timestamp }] }
  }

  getConversationHistory(conversationId, studentId = null) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, { student_id: studentId, messages: [] });
    }
    const conv = this.conversations.get(conversationId);
    // Backward compatibility if conv is raw array
    if (Array.isArray(conv)) {
      const wrapped = { student_id: studentId, messages: conv };
      this.conversations.set(conversationId, wrapped);
      return wrapped.messages;
    }
    if (studentId && conv.student_id && conv.student_id !== studentId) {
      throw new Error("Access Denied: You do not have permission to view this conversation");
    }
    if (!conv.student_id && studentId) {
      conv.student_id = studentId;
    }
    return conv.messages;
  }

  setConversationHistory(conversationId, history, studentId = null) {
    if (Array.isArray(history)) {
      this.conversations.set(conversationId, {
        student_id: studentId,
        messages: history.slice(-20)
      });
    }
  }

  addMessage(conversationId, role, content, sources = [], studentId = null) {
    const history = this.getConversationHistory(conversationId, studentId);
    history.push({ role, content, sources, timestamp: new Date().toISOString() });
    // Keep last 10 turns (Window Buffer Memory)
    if (history.length > 20) {
      history.shift();
    }
  }

  clearMemory(conversationId, studentId = null) {
    if (this.conversations.has(conversationId)) {
      const conv = this.conversations.get(conversationId);
      const convStudentId = Array.isArray(conv) ? null : conv.student_id;
      if (studentId && convStudentId && convStudentId !== studentId) {
        throw new Error("Access Denied: You do not have permission to clear this conversation");
      }
      this.conversations.delete(conversationId);
    }
  }

  createConversation(studentId, subjectId, title = "Academic Chat", customId = null) {
    const id = customId || "conv_" + Math.random().toString(36).substring(2, 10);
    const conv = {
      id,
      student_id: studentId,
      subject_id: subjectId,
      title: title || "Academic Chat",
      created_at: new Date().toISOString(),
      messages: []
    };
    this.conversations.set(id, conv);
    return conv;
  }

  getConversations(studentId, subjectId = null) {
    const list = [];
    for (const [id, data] of this.conversations.entries()) {
      const convStudentId = Array.isArray(data) ? null : data.student_id;
      const convSubjectId = Array.isArray(data) ? null : data.subject_id;
      if (convStudentId === studentId) {
        if (!subjectId || convSubjectId === subjectId) {
          list.push({
            id,
            student_id: convStudentId,
            subject_id: convSubjectId,
            title: data.title || "Academic Chat",
            created_at: data.created_at || new Date().toISOString(),
            message_count: data.messages ? data.messages.length : (Array.isArray(data) ? data.length : 0)
          });
        }
      }
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  /**
   * Resolves references like "it", "that", "explain it" using conversational history
   */
  resolveContextualQuery(query, history) {
    const lower = query.toLowerCase().trim();
    const pronouns = ["it", "this", "that", "the same", "them", "these"];
    const hasPronounRef = pronouns.some((p) => new RegExp(`\\b${p}\\b`, "i").test(lower));

    if (hasPronounRef && history.length >= 2) {
      // Look back at recent user/assistant turns to extract main topic
      const recentTurns = history.slice(-4).map((h) => h.content).join(" ");
      return `${query} (Context from previous discussion: ${recentTurns.slice(0, 300)})`;
    }
    return query;
  }

  /**
   * Main Agent Execution Loop:
   * 1. Query Interpretation & Memory Context
   * 2. Knowledge Tool Decision & Execution
   * 3. Grounded Synthesis (via Gemini or Local Grounded Synthesizer)
   * 4. Source Citation & Memory Update
   */
  async processUserMessage(params) {
    const {
      student_id,
      question,
      conversation_id = "default_session",
      subject_id = null,
      course_id = null,
      unit = null,
      mode = "NORMAL"
    } = params;

    if (!student_id || !question) {
      throw new Error("student_id and question are required");
    }

    // 0. Prompt Injection & Adversarial Defense Check (Stage 14)
    if (detectAdversarialInput(question)) {
      const securityResponse = "I am your personal academic tutor strictly grounded in your course materials. System prompt overrides and non-academic instruction requests cannot be executed.";
      this.addMessage(conversation_id, "user", question, [], student_id);
      this.addMessage(conversation_id, "assistant", securityResponse, [], student_id);
      return {
        conversation_id,
        student_id,
        question,
        answer: securityResponse,
        sources: [],
        found_in_notes: false,
        mode: mode || "NORMAL",
        intent: "general",
        detected_unit: null
      };
    }

    // Stage 18: Autonomous Intent Classification & Syllabus Unit Extraction
    const detectedUnit = detectUnit(question);
    const activeUnit = unit || detectedUnit;

    const classifiedIntent = classifyIntent(question, mode);
    let resolvedMode = mode;
    if (!mode || mode.toLowerCase() === "auto") {
      resolvedMode = classifiedIntent === "general" ? "LEARN" : classifiedIntent.toUpperCase();
    } else {
      resolvedMode = mode.toUpperCase();
    }

    const history = this.getConversationHistory(conversation_id, student_id);
    const resolvedQuestion = this.resolveContextualQuery(question, history);
    const upperMode = resolvedMode;

    const topK = upperMode === "SUMMARY" ? 6 : (upperMode === "FIND" ? 5 : 3);
    const similarityThreshold = (upperMode === "SUMMARY" || upperMode === "STUDY_PLAN" || upperMode === "QUIZ") ? 0.20 : 0.20;

    // 1. Tool Call: Search Student Knowledge Base
    const retrievalResult = await this.ragService.queryKnowledge(resolvedQuestion, {
      student_id,
      subject_id,
      course_id,
      unit: activeUnit,
      mode: upperMode,
      topK,
      similarityThreshold
    });

    let finalAnswer = "";
    let sources = retrievalResult.sources || [];

    if (!retrievalResult.found_in_notes) {
      finalAnswer = MISSING_INFO_FALLBACK;
    } else {
      // 2. Synthesize with Gemini if API key is present, or use grounded template
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        try {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

          const modeGuidelines = {
            NORMAL: "Provide a clear, simple, and direct explanation grounded strictly in the notes.",
            LEARN: "Teach like a classroom teacher. Explain concepts in simple language starting from the basic idea with an everyday analogy and step-by-step breakdown.",
            EXPLAIN: "Provide an intuitive explanation with a relatable real-world analogy, step-by-step breakdown without jargon, and a quick memorable takeaway.",
            EXAM: "Format as a structured university model answer suitable for the requested marks (e.g. 10-mark with definition, diagram cue, components, trade-offs, and scoring keywords; or concise 2-mark answer). Include clear ASCII text diagram cues when architecture or processes are explained.",
            FIND: "Act as a document locator: list each source document, page number, relevance, exact quoted snippet from notes, and section context.",
            SUMMARY: "Synthesize a comprehensive unit revision summary: 1. Unit overview, 2. Checklist of core concepts, 3. Key definitions, 4. Likely university exam questions.",
            QUIZ: "Generate 3 multiple-choice questions with options (A-D) directly from the facts in the notes, followed by an answer key with exact document and page references.",
            STUDY_PLAN: "Generate a realistic multi-day revision timetable with daily topics, recommended hours, study methods, and exam tips based on the notes."
          };

          const selectedGuideline = modeGuidelines[resolvedMode] || modeGuidelines.NORMAL;

          const prompt = `
${SYSTEM_PROMPT}

Student ID: ${student_id}
Subject: ${subject_id || "All Subjects"}
Active Academic Mode: ${resolvedMode}
Detected Unit: ${detectedUnit || "N/A"}

MODE REQUIREMENT:
${selectedGuideline}

STUDENT'S UPLOADED COURSE NOTES:
${retrievalResult.sources.map((s) => `[Document: ${s.resource_name}, Page: ${s.page_number}, Unit: ${s.unit}]`).join("\n")}
Context Chunks:
${retrievalResult.answer}

CONVERSATION HISTORY:
${history.slice(-4).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

STUDENT QUERY / TOPIC:
${question}

INSTRUCTIONS FOR ANSWER:
- Base your response strictly on the provided course notes above.
- Follow the MODE REQUIREMENT formatting specified.
- Cite the source document name and page number at the end under a "**Sources**" section.
- If the question cannot be answered from the notes, output exactly: "${MISSING_INFO_FALLBACK}"
`;
          const result = await model.generateContent(prompt);
          finalAnswer = result.response.text();
        } catch (apiErr) {
          console.warn("Gemini API call skipped/failed, using local synthesis:", apiErr.message);
          finalAnswer = retrievalResult.answer;
        }
      } else {
        finalAnswer = retrievalResult.answer;
      }
    }

    // 3. Update Memory
    this.addMessage(conversation_id, "user", question, [], student_id);
    this.addMessage(conversation_id, "assistant", finalAnswer, sources, student_id);

    return {
      conversation_id,
      student_id,
      question,
      answer: finalAnswer,
      sources,
      found_in_notes: retrievalResult.found_in_notes,
      mode: resolvedMode,
      intent: classifiedIntent,
      detected_unit: detectedUnit
    };
  }
}

module.exports = {
  AgentOrchestrator,
  classifyIntent,
  detectUnit,
  defaultAgentOrchestrator: new AgentOrchestrator()
};
