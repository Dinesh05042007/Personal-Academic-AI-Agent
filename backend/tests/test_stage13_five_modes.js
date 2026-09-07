const axios = require("axios");
const path = require("path");
const app = require("../server");
const { defaultRAGService } = require("../src/ragService");

async function runStage13Tests() {
  console.log("==================================================================");
  console.log("🚀 RUNNING STAGE 13: 5 AI MODES VERIFICATION");
  console.log("==================================================================\n");

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  console.log(`Server listening on port: ${port}\n`);

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
    const testPdfPath = path.join(__dirname, "../../documents/Operating_Systems_Unit_1.pdf");
    await defaultRAGService.ingestDocument(testPdfPath, {
      student_id: "student_A_uuid",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      unit: "Unit 1",
      resource_name: "Operating Systems Unit 1.pdf",
      mimeType: "application/pdf"
    });

    // TEST 1: Learn Mode (Step 459 & 478)
    console.log("--- TEST 1: Learn Mode (Teacher-style Explanation) ---");
    const learnRes = await studentAClient.post("/api/chat", {
      question: "Explain dual-mode operation in operating systems",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "learn"
    });
    console.log("Learn Mode Output Snippet:\n", learnRes.data.answer.slice(0, 220) + "...\n");
    if (
      learnRes.data.found_in_notes &&
      (learnRes.data.answer.includes("Analogy") || learnRes.data.answer.includes("bank")) &&
      learnRes.data.answer.includes("Step-by-Step")
    ) {
      console.log("✅ TEST 1 PASSED: Learn mode delivered teacher-style analogy and breakdown.\n");
    } else {
      throw new Error("❌ TEST 1 FAILED: Learn mode missing expected structure");
    }

    // TEST 2: Exam Mode - 10 Marks (Step 460 & 479)
    console.log("--- TEST 2: Exam Mode - 10 Mark Answer ---");
    const exam10Res = await studentAClient.post("/api/chat", {
      question: "Explain dual-mode operation for 10 marks",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "exam"
    });
    console.log("10-Mark Exam Output Snippet:\n", exam10Res.data.answer.slice(0, 250) + "...\n");
    if (
      exam10Res.data.found_in_notes &&
      exam10Res.data.answer.includes("10-Mark") &&
      exam10Res.data.answer.includes("Diagram Cue") &&
      exam10Res.data.answer.includes("Scoring Keywords")
    ) {
      console.log("✅ TEST 2 PASSED: Exam mode generated structured 10-mark answer with diagram cue.\n");
    } else {
      throw new Error("❌ TEST 2 FAILED: 10-mark exam answer failed");
    }

    // TEST 3: Exam Mode - 2 Mark Answer (Step 461)
    console.log("--- TEST 3: Exam Mode - 2 Mark Detection ---");
    const exam2Res = await studentAClient.post("/api/chat", {
      question: "Explain dual-mode operation for 2 marks",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "exam"
    });
    console.log("2-Mark Exam Output Snippet:\n", exam2Res.data.answer + "\n");
    if (
      exam2Res.data.found_in_notes &&
      exam2Res.data.answer.includes("2-Mark") &&
      exam2Res.data.answer.includes("Key Exam Point")
    ) {
      console.log("✅ TEST 3 PASSED: Mark detection successfully produced concise 2-mark answer.\n");
    } else {
      throw new Error("❌ TEST 3 FAILED: 2-mark exam answer failed");
    }

    // TEST 4: Summary Mode (Step 462 & 480)
    console.log("--- TEST 4: Summary Mode (Unit Overview) ---");
    const summaryRes = await studentAClient.post("/api/chat", {
      question: "Summarize Unit 1",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "summary"
    });
    console.log("Summary Mode Output Snippet:\n", summaryRes.data.answer.slice(0, 250) + "...\n");
    if (
      summaryRes.data.found_in_notes &&
      summaryRes.data.answer.includes("Summary") &&
      summaryRes.data.answer.includes("Checklist")
    ) {
      console.log("✅ TEST 4 PASSED: Summary mode produced unit overview and checklist.\n");
    } else {
      throw new Error("❌ TEST 4 FAILED: Summary mode failed");
    }

    // TEST 5: Quiz Mode (Step 463 & 481)
    console.log("--- TEST 5: Quiz Mode (Practice Questions) ---");
    const quizRes = await studentAClient.post("/api/chat", {
      question: "Quiz me on Unit 1",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "quiz"
    });
    console.log("Quiz Mode Output Snippet:\n", quizRes.data.answer.slice(0, 260) + "...\n");
    if (
      quizRes.data.found_in_notes &&
      quizRes.data.answer.includes("Question 1") &&
      quizRes.data.answer.includes("Answer Key")
    ) {
      console.log("✅ TEST 5 PASSED: Quiz mode generated practice questions and answer key.\n");
    } else {
      throw new Error("❌ TEST 5 FAILED: Quiz mode failed");
    }

    // TEST 6: Find Mode (Step 465 & 482)
    console.log("--- TEST 6: Find Mode (Resource Locator) ---");
    const findRes = await studentAClient.post("/api/chat", {
      question: "Where is privileged mode discussed?",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "find"
    });
    console.log("Find Mode Output Snippet:\n", findRes.data.answer.slice(0, 260) + "...\n");
    if (
      findRes.data.found_in_notes &&
      findRes.data.answer.includes("Resource Locator") &&
      findRes.data.answer.includes("Operating Systems Unit 1.pdf") &&
      findRes.data.sources[0]?.page_number === 1
    ) {
      console.log("✅ TEST 6 PASSED: Find mode located exact file, page number, and quoted excerpt.\n");
    } else {
      throw new Error("❌ TEST 6 FAILED: Find mode failed");
    }

    // TEST 7: Missing Info Fallback Across All 5 Modes (Step 445)
    console.log("--- TEST 7: Strict Fallback on Ungrounded Topics ---");
    const fiveModes = ["learn", "exam", "summary", "quiz", "find"];
    for (const m of fiveModes) {
      const res = await studentAClient.post("/api/chat", {
        question: "Explain quantum entanglement in interstellar cryptography",
        course_id: "course_btech_cse",
        subject_id: "subj_os",
        mode: m
      });
      if (
        !res.data.found_in_notes &&
        res.data.answer === "I couldn't find enough information about this topic in your uploaded course materials."
      ) {
        // Pass
      } else {
        throw new Error(`❌ TEST 7 FAILED: Mode ${m} failed to trigger fallback!`);
      }
    }
    console.log("✅ TEST 7 PASSED: All 5 modes strictly returned missing info fallback without hallucination.\n");

    // TEST 8: Tenant Isolation Boundary (Step 446)
    console.log("--- TEST 8: Tenant Privacy Across Modes ---");
    const studentBRes = await studentBClient.post("/api/chat", {
      question: "Explain dual-mode operation for 10 marks",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "exam"
    });
    if (!studentBRes.data.found_in_notes && studentBRes.data.sources.length === 0) {
      console.log("✅ TEST 8 PASSED: Student B cannot access Student A's notes or generate answers.\n");
    } else {
      throw new Error("❌ TEST 8 FAILED: Tenant privacy leak detected!");
    }

    console.log("🎉 ALL 8 STAGE 13 FIVE AI MODES TESTS PASSED SUCCESSFULLY!");
  } finally {
    server.close();
  }
}

runStage13Tests().catch((err) => {
  console.error("Stage 13 test failed:", err);
  process.exit(1);
});
