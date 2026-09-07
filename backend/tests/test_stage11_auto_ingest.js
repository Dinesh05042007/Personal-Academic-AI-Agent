const axios = require("axios");
const path = require("path");
const app = require("../server");
const { defaultStorageService } = require("../src/storageService");
const { defaultAcademicStore } = require("../src/academicStore");

async function runStage11Tests() {
  console.log("==================================================================");
  console.log("⚡ RUNNING STAGE 11: AUTOMATIC PDF INGESTION & PIPELINE TESTS");
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
    // 1. Prepare private test PDF file in storage
    const testPdfPath = path.join(__dirname, "../../documents/Operating_Systems_Unit_1.pdf");
    const testResource = defaultAcademicStore.addResource("student_A_uuid", {
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      name: "Operating Systems Unit 1.pdf",
      unit: "Unit 1",
      file_path: testPdfPath,
      processing_status: "pending"
    });

    console.log(`1. Created resource record in database (Initial Status: ${testResource.processing_status})`);

    // TEST 1: Trigger automated PDF processing via POST /api/process-resource (Step 384)
    console.log("--- TEST 1: Automated PDF Processing (Step 384) ---");
    const processRes = await studentAClient.post("/api/process-resource", {
      resource_id: testResource.id,
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      file_path: testPdfPath,
      resource_name: "Operating Systems Unit 1.pdf"
    });

    console.log("Processing Response:", processRes.data);
    if (processRes.data.success && processRes.data.processing_status === "completed") {
      console.log("✅ TEST 1 PASSED: Automatic PDF processing completed with vector insertion.\n");
    } else {
      throw new Error("❌ TEST 1 FAILED: PDF processing did not complete");
    }

    // TEST 2: Check updated resource status
    console.log("--- TEST 2: Resource Status Progression Check (Step 408) ---");
    const statusRes = await studentAClient.get(`/api/student/resources/${testResource.id}/status`);
    console.log(`Live status in database: "${statusRes.data.processing_status}"`);
    if (statusRes.data.processing_status === "completed") {
      console.log("✅ TEST 2 PASSED: Resource status successfully transitioned to 'completed'.\n");
    } else {
      throw new Error("❌ TEST 2 FAILED: Expected completed status");
    }

    // TEST 3: Ask question from newly processed PDF (Step 403)
    console.log("--- TEST 3: AI Agent Retrieval from Newly Ingested PDF (Step 403) ---");
    const chatRes1 = await studentAClient.post("/api/chat", {
      question: "What is dual-mode operation in an operating system?",
      subject_id: "subj_os",
      conversation_id: "stage11_conv"
    });
    console.log("AI Answer:\n", chatRes1.data.answer);
    console.log("Source File:", chatRes1.data.sources[0]?.resource_name);
    console.log("Source Page:", chatRes1.data.sources[0]?.page_number);

    if (chatRes1.data.found_in_notes && chatRes1.data.sources[0]?.page_number === 1) {
      console.log("✅ TEST 3 PASSED: Concept from PDF Page 1 retrieved and cited.\n");
    } else {
      throw new Error("❌ TEST 3 FAILED: Failed to retrieve dual-mode operation from PDF");
    }

    // TEST 4: Semantic Search with Different Wording (Step 404)
    console.log("--- TEST 4: Different Wording Semantic Retrieval (Step 404) ---");
    const chatRes2 = await studentAClient.post("/api/chat", {
      question: "Why does the CPU need user mode and privileged mode?",
      subject_id: "subj_os",
      conversation_id: "stage11_conv"
    });
    console.log("AI Answer:\n", chatRes2.data.answer);
    if (chatRes2.data.found_in_notes) {
      console.log("✅ TEST 4 PASSED: Semantic match succeeded despite alternate phrasing.\n");
    } else {
      throw new Error("❌ TEST 4 FAILED: Different wording test failed");
    }

    // TEST 5: Missing / Out-of-scope Question (Step 405)
    console.log("--- TEST 5: Out-of-scope Question Fallback (Step 405) ---");
    const chatRes3 = await studentAClient.post("/api/chat", {
      question: "Explain dark matter in theoretical physics",
      subject_id: "subj_os",
      conversation_id: "stage11_conv"
    });
    console.log(`Answer: "${chatRes3.data.answer}"`);
    if (!chatRes3.data.found_in_notes && chatRes3.data.answer.includes("couldn't find")) {
      console.log("✅ TEST 5 PASSED: Strict fallback triggered for ungrounded topic.\n");
    } else {
      throw new Error("❌ TEST 5 FAILED: Expected fallback on out-of-scope question");
    }

    // TEST 6: Student Isolation (Step 407)
    console.log("--- TEST 6: Student Isolation Boundary (Step 407) ---");
    const chatRes4 = await studentBClient.post("/api/chat", {
      question: "What is dual-mode operation in my operating system notes?",
      subject_id: "subj_os",
      conversation_id: "stage11_student_b"
    });
    console.log(`Student B Query Result: Found in notes = ${chatRes4.data.found_in_notes}`);
    if (!chatRes4.data.found_in_notes && chatRes4.data.sources.length === 0) {
      console.log("✅ TEST 6 PASSED: Student B cannot search Student A's newly processed PDF.\n");
    } else {
      throw new Error("❌ TEST 6 FAILED: Tenant privacy breach!");
    }

    console.log("🎉 ALL STAGE 11 AUTOMATIC PDF PROCESSING TESTS PASSED!");
  } finally {
    server.close();
  }
}

runStage11Tests().catch((err) => {
  console.error("Stage 11 test failed:", err);
  process.exit(1);
});
