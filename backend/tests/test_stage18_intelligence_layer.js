const axios = require("axios");
const path = require("path");
const app = require("../server");
const { defaultRAGService, MISSING_INFO_FALLBACK } = require("../src/ragService");
const { classifyIntent, detectUnit } = require("../src/agentOrchestrator");

async function runStage18Tests() {
  console.log("==================================================================");
  console.log("🧠 RUNNING STAGE 18: AI INTELLIGENCE LAYER VERIFICATION");
  console.log("==================================================================");

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  console.log(`Server listening on port: ${port}\n`);

  const studentClient = axios.create({
    baseURL: `http://localhost:${port}`,
    headers: {
      Authorization: "Bearer token_student_A",
      "Content-Type": "application/json"
    }
  });

  try {
    // 0. Ensure student A has the test PDF ingested into their knowledge base
    const testPdfPath = path.join(__dirname, "../../documents/Operating_Systems_Unit_1.pdf");
    await defaultRAGService.ingestDocument(testPdfPath, {
      student_id: "student_A_uuid",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      unit: "Unit 1",
      resource_name: "Operating Systems Unit 1.pdf",
      mimeType: "application/pdf"
    });

    // --- TEST 1: Learn Intent Auto-Detection ---
    console.log("--- TEST 1: Learn Intent Auto-Detection ---");
    const test1Query = "Explain process management simply";
    const test1Intent = classifyIntent(test1Query);
    if (test1Intent !== "learn") {
      throw new Error(`Expected intent 'learn', got '${test1Intent}'`);
    }

    const learnRes = await studentClient.post("/api/chat", {
      question: test1Query,
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "auto"
    });

    if (learnRes.data.intent === "learn" && learnRes.data.found_in_notes && learnRes.data.answer.includes("Analogy")) {
      console.log("   Intent detected:", learnRes.data.intent);
      console.log("   Output snippet:\n", learnRes.data.answer.slice(0, 150) + "...\n");
      console.log("✅ TEST 1 PASSED: Learn intent detected and beginner explanation returned.\n");
    } else {
      throw new Error("TEST 1 FAILED: Learn intent failed or response structure incorrect");
    }

    // --- TEST 2: Exam Intent Auto-Detection with ASCII Architecture Diagram ---
    console.log("--- TEST 2: Exam Intent Auto-Detection & ASCII Diagram ---");
    const test2Query = "Give me a 10-mark answer on dual-mode operation";
    const test2Intent = classifyIntent(test2Query);
    if (test2Intent !== "exam") {
      throw new Error(`Expected intent 'exam', got '${test2Intent}'`);
    }

    const examRes = await studentClient.post("/api/chat", {
      question: test2Query,
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "auto"
    });

    const hasAsciiBox = examRes.data.answer.includes("+---") || examRes.data.answer.includes("|");
    if (examRes.data.intent === "exam" && examRes.data.answer.includes("10-Mark University Model Answer") && hasAsciiBox) {
      console.log("   Intent detected:", examRes.data.intent);
      console.log("   ASCII Diagram found:", hasAsciiBox);
      console.log("   Output snippet:\n", examRes.data.answer.slice(0, 180) + "...\n");
      console.log("✅ TEST 2 PASSED: Exam intent detected and structured answer with ASCII diagram returned.\n");
    } else {
      throw new Error("TEST 2 FAILED: Exam intent failed or missing ASCII diagram");
    }

    // --- TEST 3: Summary Intent Auto-Detection ---
    console.log("--- TEST 3: Summary Intent Auto-Detection ---");
    const test3Query = "Summarize Unit 1 Process Management";
    const test3Intent = classifyIntent(test3Query);
    if (test3Intent !== "summary") {
      throw new Error(`Expected intent 'summary', got '${test3Intent}'`);
    }

    const summaryRes = await studentClient.post("/api/chat", {
      question: test3Query,
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "auto"
    });

    if (summaryRes.data.intent === "summary" && summaryRes.data.answer.includes("Unit Revision Summary") && summaryRes.data.detected_unit === "Unit 1") {
      console.log("   Intent detected:", summaryRes.data.intent);
      console.log("   Detected unit:", summaryRes.data.detected_unit);
      console.log("   Output snippet:\n", summaryRes.data.answer.slice(0, 160) + "...\n");
      console.log("✅ TEST 3 PASSED: Summary intent and unit detected, revision overview generated.\n");
    } else {
      throw new Error("TEST 3 FAILED: Summary intent or unit detection failed");
    }

    // --- TEST 4: Quiz Intent Auto-Detection ---
    console.log("--- TEST 4: Quiz Intent Auto-Detection ---");
    const test4Query = "Quiz me on CPU scheduling";
    const test4Intent = classifyIntent(test4Query);
    if (test4Intent !== "quiz") {
      throw new Error(`Expected intent 'quiz', got '${test4Intent}'`);
    }

    const quizRes = await studentClient.post("/api/chat", {
      question: test4Query,
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "auto"
    });

    if (quizRes.data.intent === "quiz" && quizRes.data.answer.includes("Question 1") && quizRes.data.answer.includes("Quiz Answer Key")) {
      console.log("   Intent detected:", quizRes.data.intent);
      console.log("   Output snippet:\n", quizRes.data.answer.slice(0, 170) + "...\n");
      console.log("✅ TEST 4 PASSED: Quiz intent detected and practice questions with key returned.\n");
    } else {
      throw new Error("TEST 4 FAILED: Quiz intent failed");
    }

    // --- TEST 5: Find Intent Auto-Detection ---
    console.log("--- TEST 5: Find Intent Auto-Detection ---");
    const test5Query = "Which PDF contains privileged mode?";
    const test5Intent = classifyIntent(test5Query);
    if (test5Intent !== "find") {
      throw new Error(`Expected intent 'find', got '${test5Intent}'`);
    }

    const findRes = await studentClient.post("/api/chat", {
      question: test5Query,
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "auto"
    });

    if (findRes.data.intent === "find" && findRes.data.answer.includes("Resource Locator") && findRes.data.sources.length > 0) {
      console.log("   Intent detected:", findRes.data.intent);
      console.log("   Primary citation:", findRes.data.sources[0]?.resource_name, "Page:", findRes.data.sources[0]?.page_number);
      console.log("✅ TEST 5 PASSED: Find intent detected and exact resource locator returned.\n");
    } else {
      throw new Error("TEST 5 FAILED: Find intent failed");
    }

    // --- TEST 6: Syllabus Unit Awareness & Scoping ---
    console.log("--- TEST 6: Syllabus Unit Awareness & Scoping ---");
    const test6Query = "Explain Unit 1 dual mode operation";
    const detected = detectUnit(test6Query);
    if (detected !== "Unit 1") {
      throw new Error(`Expected unit 'Unit 1', got '${detected}'`);
    }

    const unitRes = await studentClient.post("/api/chat", {
      question: test6Query,
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "auto"
    });

    if (unitRes.data.detected_unit === "Unit 1" && unitRes.data.sources.every((s) => s.unit === "Unit 1")) {
      console.log("   Detected syllabus unit:", unitRes.data.detected_unit);
      console.log("   Retrieved sources verified for unit:", unitRes.data.sources.map((s) => s.unit));
      console.log("✅ TEST 6 PASSED: Unit 1 extracted and retrieval scoped to Unit 1 chunks.\n");
    } else {
      throw new Error("TEST 6 FAILED: Unit scoping failed");
    }

    // --- TEST 7: Anti-Hallucination & Missing Knowledge Fallback ---
    console.log("--- TEST 7: Anti-Hallucination Fallback in Auto Mode ---");
    const test7Query = "Explain quantum entanglement and teleportation algorithms";
    const fallbackRes = await studentClient.post("/api/chat", {
      question: test7Query,
      conversation_id: "conv_stage18_fallback",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "auto"
    });

    if (fallbackRes.data.found_in_notes === false && fallbackRes.data.answer === MISSING_INFO_FALLBACK) {
      console.log("   Response text:", fallbackRes.data.answer);
      console.log("✅ TEST 7 PASSED: Missing knowledge query strictly declined without hallucination.\n");
    } else {
      console.error("Test 7 actual response:", fallbackRes.data);
      throw new Error("TEST 7 FAILED: Expected missing info fallback");
    }

    // --- TEST 8: Explicit Mode Priority Override ---
    console.log("--- TEST 8: Explicit Mode Priority Override ---");
    const test8Query = "Explain process states";
    // Student explicitly selected "exam" mode ribbon, overriding natural query
    const overrideRes = await studentClient.post("/api/chat", {
      question: test8Query,
      conversation_id: "conv_stage18_override",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      mode: "exam"
    });

    if (overrideRes.data.mode === "EXAM" && overrideRes.data.intent === "exam" && overrideRes.data.answer.includes("Model Answer")) {
      console.log("   Explicit mode maintained:", overrideRes.data.mode);
      console.log("   Intent recorded:", overrideRes.data.intent);
      console.log("✅ TEST 8 PASSED: Explicit mode priority override functions correctly.\n");
    } else {
      throw new Error("TEST 8 FAILED: Explicit mode priority failed");
    }

    // --- TEST 9: Modes Directory Includes AUTO Mode ---
    console.log("--- TEST 9: Academic Modes Directory Discovery ---");
    const modesRes = await studentClient.get("/api/academic/modes");
    const allModes = modesRes.data.modes;
    const hasAuto = allModes.some((m) => m.id === "AUTO");
    if (hasAuto && allModes.length >= 8) {
      console.log(`   Found ${allModes.length} modes, including AUTO:`, allModes.map((m) => m.id).join(", "));
      console.log("✅ TEST 9 PASSED: AUTO mode registered in academic directory.\n");
    } else {
      throw new Error("TEST 9 FAILED: AUTO mode not found in modes directory");
    }

    console.log("==================================================================");
    console.log("🎉 ALL 9 STAGE 18 AI INTELLIGENCE LAYER TESTS PASSED!");
    console.log("==================================================================\n");
  } catch (err) {
    console.error("❌ STAGE 18 TESTS FAILED:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
    process.exit(1);
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runStage18Tests();
}

module.exports = runStage18Tests;
