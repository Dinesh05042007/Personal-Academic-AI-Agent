const axios = require("axios");
const path = require("path");
const fs = require("fs");
const http = require("http");
const FormData = require("form-data");
const app = require("../server");
const { defaultRAGService, MISSING_INFO_FALLBACK } = require("../src/ragService");
const { registerDevToken } = require("../src/authMiddleware");
const { defaultAcademicStore } = require("../src/academicStore");

let server;
let baseUrl;
let port;

async function runStage15AutoUploadPipelineTests() {
  console.log("==================================================================");
  console.log("🚀 RUNNING STAGE 15: AUTOMATIC UPLOAD & PROCESSING PIPELINE TESTS");
  console.log("==================================================================\n");

  // Spin up ephemeral test server
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`Ephemeral Test Server listening on port: ${port}\n`);
      resolve();
    });
  });

  const studentA = "student_A_stage15";
  registerDevToken("token_student_A_stage15", {
    id: studentA,
    student_id: studentA,
    email: "student_a_stage15@college.edu",
    name: "Student Alpha 15"
  });

  const authHeaders = { Authorization: "Bearer token_student_A_stage15" };

  // Setup course and subject
  const course = defaultAcademicStore.addCourse(studentA, "B.Tech Computer Science", "Semester 3");
  const subject = defaultAcademicStore.addSubject(studentA, course.id, "Operating Systems", "CS301");

  const samplePdfPath = path.join(__dirname, "../../documents/Operating_Systems_Unit_1.pdf");
  if (!fs.existsSync(samplePdfPath)) {
    throw new Error(`Sample PDF missing at ${samplePdfPath}`);
  }

  // =========================================================================
  // TEST 1: Upload PDF & Initial Resource Creation (Step 537-538)
  // =========================================================================
  console.log("--- TEST 1: Upload PDF & Resource Creation ---");
  const form = new FormData();
  form.append("course_id", course.id);
  form.append("subject_id", subject.id);
  form.append("unit", "Unit 1");
  form.append("resource_name", "OS_Unit_1_Auto_Ingest.pdf");
  form.append("file", fs.createReadStream(samplePdfPath));

  const uploadRes = await axios.post(`${baseUrl}/api/resources/ingest`, form, {
    headers: {
      ...authHeaders,
      ...form.getHeaders()
    }
  });

  console.log(`   Upload response message: "${uploadRes.data.message}"`);
  console.log(`   Chunks extracted and embedded: ${uploadRes.data.chunks_count}, Pages: ${uploadRes.data.pages_count}`);

  const resources = defaultAcademicStore.getResources(studentA, subject.id);
  const newlyCreated = resources.find((r) => r.name === "OS_Unit_1_Auto_Ingest.pdf");

  if (newlyCreated && newlyCreated.student_id === studentA) {
    console.log(`   Resource ID: ${newlyCreated.id}, Initial Status: ${newlyCreated.processing_status}`);
    console.log("✅ TEST 1 PASSED: PDF uploaded and registered in academic store.\n");
  } else {
    throw new Error("❌ TEST 1 FAILED: Resource was not registered for student!");
  }

  // =========================================================================
  // TEST 2: Process-Resource Endpoint & Status Transition (Step 532 & 554)
  // =========================================================================
  console.log("--- TEST 2: Trigger Document Processing & Status Progression ---");
  const processRes = await axios.post(
    `${baseUrl}/api/process-resource`,
    {
      resource_id: newlyCreated.id,
      course_id: course.id,
      subject_id: subject.id,
      file_path: newlyCreated.file_path,
      resource_name: newlyCreated.name
    },
    { headers: authHeaders }
  );

  console.log(`   Processing result: success=${processRes.data.success}, status=${processRes.data.processing_status}`);
  console.log(`   Orchestration engine: ${processRes.data.orchestrator}`);

  if (processRes.data.success && processRes.data.processing_status === "completed") {
    console.log("✅ TEST 2 PASSED: Automatic pipeline executed and reached 'completed' status.\n");
  } else {
    throw new Error("❌ TEST 2 FAILED: Processing did not complete successfully!");
  }

  // =========================================================================
  // TEST 3: Status Polling Endpoint Verification (Step 558)
  // =========================================================================
  console.log("--- TEST 3: Live Status Polling Endpoint ---");
  const statusRes = await axios.get(`${baseUrl}/api/student/resources/${newlyCreated.id}/status`, {
    headers: authHeaders
  });

  console.log(`   Fetched live status: ${statusRes.data.processing_status} for ${statusRes.data.name}`);
  if (statusRes.data.processing_status === "completed") {
    console.log("✅ TEST 3 PASSED: Status endpoint accurately reflects 'completed' (🟢 Ready for AI).\n");
  } else {
    throw new Error("❌ TEST 3 FAILED: Status did not report completed!");
  }

  // =========================================================================
  // TEST 4: Immediate AI Semantic Recall - Learn Mode (Step 562 Test 6)
  // =========================================================================
  console.log("--- TEST 4: Learn Mode Grounded In Newly Ingested PDF ---");
  const learnRes = await axios.post(
    `${baseUrl}/api/chat`,
    {
      question: "Explain the main concept of dual-mode operation in operating systems",
      subject_id: subject.id,
      conversation_id: "conv_stage15_learn",
      mode: "learn"
    },
    { headers: authHeaders }
  );

  console.log(`   Learn Mode snippet: ${learnRes.data.answer.slice(0, 150)}...`);
  if (learnRes.data.answer.includes("Dual-Mode") || learnRes.data.answer.includes("User Mode")) {
    console.log("✅ TEST 4 PASSED: AI Agent immediately retrieved concept from uploaded PDF.\n");
  } else {
    throw new Error("❌ TEST 4 FAILED: Learn mode failed to retrieve newly ingested PDF content!");
  }

  // =========================================================================
  // TEST 5: Immediate AI Semantic Recall - Exam Mode (Step 562 Test 8)
  // =========================================================================
  console.log("--- TEST 5: Exam Mode 10-Mark Model Answer ---");
  const examRes = await axios.post(
    `${baseUrl}/api/chat`,
    {
      question: "Give me a 10-mark answer on dual-mode operation",
      subject_id: subject.id,
      conversation_id: "conv_stage15_exam",
      mode: "exam"
    },
    { headers: authHeaders }
  );

  console.log(`   Exam Mode snippet: ${examRes.data.answer.slice(0, 150)}...`);
  if (examRes.data.answer.includes("10-Mark") || examRes.data.answer.includes("Model Answer")) {
    console.log("✅ TEST 5 PASSED: Exam mode structured answer generated from newly uploaded PDF.\n");
  } else {
    throw new Error("❌ TEST 5 FAILED: Exam mode failed to structure answer from uploaded PDF!");
  }

  // =========================================================================
  // TEST 6: Immediate AI Semantic Recall - Find Mode (Step 562 Test 9)
  // =========================================================================
  console.log("--- TEST 6: Find Mode Resource Locator ---");
  const findRes = await axios.post(
    `${baseUrl}/api/chat`,
    {
      question: "Where is privileged mode discussed?",
      subject_id: subject.id,
      conversation_id: "conv_stage15_find",
      mode: "find"
    },
    { headers: authHeaders }
  );

  console.log(`   Find Mode snippet: ${findRes.data.answer.slice(0, 150)}...`);
  const hasPageCitation = findRes.data.sources && findRes.data.sources.some((s) => s.page_number === 1);
  if (hasPageCitation || findRes.data.answer.includes("Page 1")) {
    console.log("✅ TEST 6 PASSED: Find mode accurately pinpointed exact page and document.\n");
  } else {
    throw new Error("❌ TEST 6 FAILED: Find mode failed to locate exact page reference!");
  }

  // =========================================================================
  // TEST 7: Failure Path & Error Recording (Step 555-556)
  // =========================================================================
  console.log("--- TEST 7: Failure Path & Error Recording ---");
  const corruptRes = defaultAcademicStore.addResource(studentA, {
    course_id: course.id,
    subject_id: subject.id,
    name: "Corrupt_Notes.pdf",
    unit: "Unit 1",
    file_type: "pdf",
    file_path: "non_existent_folder/missing_file.pdf",
    processing_status: "processing"
  });

  try {
    await axios.post(
      `${baseUrl}/api/process-resource`,
      {
        resource_id: corruptRes.id,
        course_id: course.id,
        subject_id: subject.id,
        file_path: corruptRes.file_path,
        resource_name: corruptRes.name
      },
      { headers: authHeaders }
    );
  } catch (err) {
    console.log(`   Caught expected failure for missing file: "${err.response?.data?.error || err.message}"`);
  }

  const updatedCorrupt = defaultAcademicStore.getResourceById(corruptRes.id);
  console.log(`   Resource status after failure: ${updatedCorrupt.processing_status}`);
  console.log(`   Stored error details: "${updatedCorrupt.processing_error}"`);

  if (updatedCorrupt.processing_status === "failed" && updatedCorrupt.processing_error) {
    console.log("✅ TEST 7 PASSED: Failure path properly transitioned status to 'failed' and recorded error details.\n");
  } else {
    throw new Error("❌ TEST 7 FAILED: Resource did not update to 'failed' with error message!");
  }

  console.log("==================================================================");
  console.log("🎉 ALL 7 STAGE 15 AUTOMATIC UPLOAD & PROCESSING TESTS PASSED!");
  console.log("==================================================================\n");
}

runStage15AutoUploadPipelineTests()
  .then(() => {
    if (server) server.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Stage 15 Test Suite Failed:", err);
    if (server) server.close();
    process.exit(1);
  });
