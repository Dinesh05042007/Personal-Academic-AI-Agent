const axios = require("axios");
const path = require("path");
const app = require("../server");
const { defaultAcademicStore } = require("../src/academicStore");
const { defaultRAGService } = require("../src/ragService");

async function runStage12Tests() {
  console.log("==================================================================");
  console.log("GRADUATION TEST: STAGE 12 ACADEMIC STUDY MODES VERIFICATION");
  console.log("==================================================================\n");

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  console.log(`Test server running on port: ${port}\n`);

  const studentAClient = axios.create({
    baseURL: `http://localhost:${port}`,
    headers: {
      Authorization: "Bearer token_student_A",
      "Content-Type": "application/json"
    }
  });

  const studentBClient = axios.create({
    baseURL: `http://localhost:${port}`,
    headers: {
      Authorization: "Bearer token_student_B",
      "Content-Type": "application/json"
    }
  });

  try {
    // 0. Ensure student A has the test PDF ingested into their knowledge base
    const testPdfPath = path.join(__dirname, "../../documents/Operating_Systems_Unit_1.pdf");
    console.log("Ingesting test document for Student A:", testPdfPath);
    await defaultRAGService.ingestDocument(testPdfPath, {
      student_id: "student_A_uuid",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      unit: "Unit 1",
      resource_name: "Operating Systems Unit 1.pdf",
      mimeType: "application/pdf"
    });

    // TEST 1: Modes Directory Endpoint (GET /api/academic/modes)
    console.log("--- TEST 1: GET /api/academic/modes ---");
    const modesRes = await studentAClient.get("/api/academic/modes");
    const availableModes = modesRes.data.modes;
    console.log(`Discovered ${availableModes.length} modes:`, availableModes.map((m) => m.id).join(", "));
    if (availableModes.length >= 7 && availableModes.some((m) => m.id === "EXAM") && availableModes.some((m) => m.id === "QUIZ")) {
      console.log("TEST 1 PASSED: All 7 study modes registered with metadata.\n");
    } else {
      throw new Error("TEST 1 FAILED: Expected 7 academic modes");
    }

    // TEST 2: NORMAL Q&A Mode
    console.log("--- TEST 2: NORMAL Mode Q&A ---");
    const normalRes = await studentAClient.post("/api/chat", {
      question: "What is dual-mode operation in operating systems?",
      subject_id: "subj_os",
      mode: "NORMAL"
    });
    console.log("Normal Mode Output Snippet:\n", normalRes.data.answer.slice(0, 180) + "...\n");
    if (normalRes.data.found_in_notes && normalRes.data.sources[0]?.page_number === 1) {
      console.log("TEST 2 PASSED: Normal mode returned grounded notes content and citation.\n");
    } else {
      throw new Error("TEST 2 FAILED: Normal mode failed retrieval");
    }

    // TEST 3: EXPLAIN (Learn & Explain) Mode
    console.log("--- TEST 3: EXPLAIN Mode (Analogy & Breakdown) ---");
    const explainRes = await studentAClient.post("/api/chat", {
      question: "Why does the CPU need user mode and kernel mode?",
      subject_id: "subj_os",
      mode: "EXPLAIN"
    });
    console.log("Explain Mode Output Snippet:\n", explainRes.data.answer.slice(0, 260) + "...\n");
    const explainText = explainRes.data.answer;
    if (
      explainRes.data.found_in_notes &&
      (explainText.includes("Analogy") || explainText.includes("bank") || explainText.includes("airport")) &&
      explainText.includes("Step-by-Step")
    ) {
      console.log("TEST 3 PASSED: Explain mode provided intuitive analogy and step-by-step breakdown.\n");
    } else {
      throw new Error("TEST 3 FAILED: Explain mode did not include expected analogy or breakdown");
    }

    // TEST 4: EXAM (10-Mark University Model Answer) Mode
    console.log("--- TEST 4: EXAM Mode (10-Mark University Structure) ---");
    const examRes = await studentAClient.post("/api/chat", {
      question: "Explain dual-mode operation with architecture diagram",
      subject_id: "subj_os",
      mode: "EXAM"
    });
    console.log("Exam Mode Output Snippet:\n", examRes.data.answer.slice(0, 300) + "...\n");
    const examText = examRes.data.answer;
    if (
      examRes.data.found_in_notes &&
      examText.includes("10-Mark University Model Answer") &&
      examText.includes("Diagram Cue") &&
      examText.includes("Scoring Keywords")
    ) {
      console.log("TEST 4 PASSED: 10-Mark exam answer produced with ASCII diagram cue and scoring points.\n");
    } else {
      throw new Error("TEST 4 FAILED: Exam mode missing 10-mark university structure");
    }

    // TEST 5: FIND (Find in Notes / Resource Locator) Mode
    console.log("--- TEST 5: FIND Mode (Document Locator) ---");
    const findRes = await studentAClient.post("/api/chat", {
      question: "Where is privileged mode described?",
      subject_id: "subj_os",
      mode: "FIND"
    });
    console.log("Find Mode Output Snippet:\n", findRes.data.answer.slice(0, 260) + "...\n");
    const findText = findRes.data.answer;
    if (
      findRes.data.found_in_notes &&
      findText.includes("Resource Locator") &&
      findText.includes("Operating Systems Unit 1.pdf") &&
      findText.includes("Match")
    ) {
      console.log("TEST 5 PASSED: Resource locator identified exact file, page, and quoted snippet.\n");
    } else {
      throw new Error("TEST 5 FAILED: Find mode failed to pinpoint document location");
    }

    // TEST 6: SUMMARY (Unit Summary) Mode
    console.log("--- TEST 6: SUMMARY Mode (Unit Revision) ---");
    const summaryRes = await studentAClient.post("/api/chat", {
      question: "Unit 1 Overview and Core Concepts",
      subject_id: "subj_os",
      mode: "SUMMARY"
    });
    console.log("Summary Mode Output Snippet:\n", summaryRes.data.answer.slice(0, 260) + "...\n");
    const summaryText = summaryRes.data.answer;
    if (
      summaryRes.data.found_in_notes &&
      summaryText.includes("Unit Revision Summary") &&
      summaryText.includes("Checklist") &&
      summaryText.includes("High-Yield University Exam Questions")
    ) {
      console.log("TEST 6 PASSED: Unit summary generated with concept checklist and predicted exam questions.\n");
    } else {
      throw new Error("TEST 6 FAILED: Unit summary mode did not format expected review structure");
    }

    // TEST 7: QUIZ (Quiz Me) Mode
    console.log("--- TEST 7: QUIZ Mode (Self-Assessment) ---");
    const quizRes = await studentAClient.post("/api/chat", {
      question: "Dual-mode operation and CPU protection",
      subject_id: "subj_os",
      mode: "QUIZ"
    });
    console.log("Quiz Mode Output Snippet:\n", quizRes.data.answer.slice(0, 300) + "...\n");
    const quizText = quizRes.data.answer;
    if (
      quizRes.data.found_in_notes &&
      quizText.includes("Course Material Quiz") &&
      quizText.includes("Question 1") &&
      quizText.includes("Question 2") &&
      quizText.includes("Answer Key")
    ) {
      console.log("TEST 7 PASSED: Interactive quiz generated directly from student notes.\n");
    } else {
      throw new Error("TEST 7 FAILED: Quiz mode failed to produce questions or answer key");
    }

    // TEST 8: STUDY_PLAN (Revision Timetable) Mode
    console.log("--- TEST 8: STUDY_PLAN Mode (5-Day Revision Timetable) ---");
    const planRes = await studentAClient.post("/api/chat", {
      question: "5-day revision schedule for Unit 1",
      subject_id: "subj_os",
      mode: "STUDY_PLAN"
    });
    console.log("Study Plan Output Snippet:\n", planRes.data.answer.slice(0, 280) + "...\n");
    const planText = planRes.data.answer;
    if (
      planRes.data.found_in_notes &&
      planText.includes("Academic Revision Timetable") &&
      planText.includes("Day 1") &&
      planText.includes("Day 5") &&
      planText.includes("Exam Success")
    ) {
      console.log("TEST 8 PASSED: Study plan generated with day-by-day timetable and references.\n");
    } else {
      throw new Error("TEST 8 FAILED: Study plan mode failed to produce timetable");
    }

    // TEST 9: Missing Info Fallback Across All Modes
    console.log("--- TEST 9: Strict Fallback Across Academic Modes ---");
    const missingModes = ["NORMAL", "EXPLAIN", "EXAM", "FIND", "SUMMARY", "QUIZ", "STUDY_PLAN"];
    for (const testMode of missingModes) {
      const fallbackRes = await studentAClient.post("/api/chat", {
        question: "Explain quantum entanglement in interstellar cryptography",
        subject_id: "subj_os",
        mode: testMode
      });
      if (
        !fallbackRes.data.found_in_notes &&
        fallbackRes.data.answer === "I couldn't find enough information about this topic in your uploaded course materials."
      ) {
        // Pass
      } else {
        throw new Error(`TEST 9 FAILED: Mode ${testMode} failed to trigger strict fallback! Got: ${fallbackRes.data.answer}`);
      }
    }
    console.log("TEST 9 PASSED: All 7 modes strictly returned missing info fallback for out-of-scope queries.\n");

    // TEST 10: Tenant Isolation Boundary
    console.log("--- TEST 10: Tenant Privacy Protection Across Modes ---");
    const studentBQuizRes = await studentBClient.post("/api/chat", {
      question: "Dual-mode operation and CPU protection",
      subject_id: "subj_os",
      mode: "QUIZ"
    });
    if (!studentBQuizRes.data.found_in_notes && studentBQuizRes.data.sources.length === 0) {
      console.log("TEST 10 PASSED: Student B cannot generate quizzes or access Student A's materials.\n");
    } else {
      throw new Error("TEST 10 FAILED: Tenant privacy breach detected!");
    }

    console.log("ALL 10 STAGE 12 ACADEMIC STUDY MODE TESTS PASSED SUCCESSFULLY!");
  } finally {
    server.close();
  }
}

runStage12Tests().catch((err) => {
  console.error("Stage 12 test failed:", err);
  process.exit(1);
});
