const axios = require("axios");
const path = require("path");
const fs = require("fs");
const http = require("http");
const app = require("../server");
const { defaultRAGService, MISSING_INFO_FALLBACK } = require("../src/ragService");
const { defaultStore } = require("../src/vectorStore");
const { registerDevToken } = require("../src/authMiddleware");
const { defaultStorageService } = require("../src/storageService");
const { defaultAcademicStore } = require("../src/academicStore");
const { defaultAgentOrchestrator } = require("../src/agentOrchestrator");

let server;
let baseUrl;
let port;

async function runStage14SecurityHardeningTests() {
  console.log("==================================================================");
  console.log("🔐 RUNNING STAGE 14: THE 10 SECURITY & STUDENT ISOLATION TESTS");
  console.log("==================================================================\n");

  // Ephemeral test HTTP server
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`Ephemeral Test Server listening on port: ${port}\n`);
      resolve();
    });
  });

  const studentA = "student_A_uuid";
  const studentB = "student_B_uuid";

  registerDevToken("token_student_A", { id: studentA, student_id: studentA, email: "student_a@college.edu", name: "Student Alpha" });
  registerDevToken("token_student_B", { id: studentB, student_id: studentB, email: "student_b@college.edu", name: "Student Beta" });

  console.log("Setting up multi-tenant academic database, storage, and vectors...");

  // 1. Setup Courses and Subjects for Student A and B
  const courseA = defaultAcademicStore.addCourse(studentA, "Computer Science Alpha", "Semester 3");
  const courseB = defaultAcademicStore.addCourse(studentB, "Information Tech Beta", "Semester 3");

  const subjA_OS = defaultAcademicStore.addSubject(studentA, courseA.id, "Operating Systems", "CS301");
  const subjA_DBMS = defaultAcademicStore.addSubject(studentA, courseA.id, "Database Systems", "CS302");
  const subjB_CN = defaultAcademicStore.addSubject(studentB, courseB.id, "Computer Networks", "IT301");

  // 2. Setup Vectors for Student A and B
  await defaultRAGService.ingestDocument(
    "Operating Systems Unit 1: Dual-Mode Operation ensures system protection. It consists of User Mode (mode bit 1) and Kernel Mode (mode bit 0). Privileged instructions can only execute in Kernel Mode.",
    {
      student_id: studentA,
      course_id: courseA.id,
      subject_id: subjA_OS.id,
      unit: "Unit 1",
      resource_name: "OS_Notes_Student_A.pdf"
    }
  );

  await defaultRAGService.ingestDocument(
    "Database Systems Unit 1: Relational database transactions adhere to ACID properties (Atomicity, Consistency, Isolation, Durability).",
    {
      student_id: studentA,
      course_id: courseA.id,
      subject_id: subjA_DBMS.id,
      unit: "Unit 1",
      resource_name: "DBMS_Notes_Student_A.pdf"
    }
  );

  await defaultRAGService.ingestDocument(
    "Computer Networks Unit 1: Student B's confidential exam protocol uses secret key CIPHER_OMEGA_999 for handshake negotiation.",
    {
      student_id: studentB,
      course_id: courseB.id,
      subject_id: subjB_CN.id,
      unit: "Unit 1",
      resource_name: "CN_Student_B_Confidential.pdf"
    }
  );

  // 3. Setup Private Storage for Student B
  defaultStorageService.saveFile(
    studentB,
    subjB_CN.id,
    "CN_Exam_Student_B.pdf",
    Buffer.from("CONFIDENTIAL STUDENT B EXAM ANSWERS")
  );

  // 4. Setup Conversation for Student B
  const convB_Id = "conv_student_b_private";
  defaultAgentOrchestrator.addMessage(convB_Id, "user", "What is my confidential exam protocol?", [], studentB);
  defaultAgentOrchestrator.addMessage(convB_Id, "assistant", "Your secret protocol is CIPHER_OMEGA_999.", [], studentB);

  console.log("   ✅ Multi-tenant environment successfully initialized.\n");

  // =========================================================================
  // TEST 1: Student A cannot see Student B courses (Step 530 Test 1)
  // =========================================================================
  console.log("--- TEST 1: Student A cannot see Student B courses ---");
  const coursesResA = await axios.get(`${baseUrl}/api/student/courses`, {
    headers: { Authorization: "Bearer token_student_A" }
  });
  const coursesA = coursesResA.data.courses || [];
  const sawStudentBCourse = coursesA.some((c) => c.student_id === studentB || c.id === courseB.id);

  if (!sawStudentBCourse && coursesA.every((c) => c.student_id === studentA)) {
    console.log(`   Student A queried courses: saw ${coursesA.length} own course(s), 0 from Student B.`);
    console.log("✅ TEST 1 PASSED: Courses isolated by student_id.\n");
  } else {
    throw new Error("❌ TEST 1 FAILED: Student A was able to see Student B's courses!");
  }

  // =========================================================================
  // TEST 2: Student A cannot see Student B subjects (Step 530 Test 2)
  // =========================================================================
  console.log("--- TEST 2: Student A cannot see Student B subjects ---");
  const subjectsResA = await axios.get(`${baseUrl}/api/student/subjects`, {
    headers: { Authorization: "Bearer token_student_A" }
  });
  const subjectsA = subjectsResA.data.subjects || [];
  const sawStudentBSubject = subjectsA.some((s) => s.student_id === studentB || s.id === subjB_CN.id);

  if (!sawStudentBSubject && subjectsA.every((s) => s.student_id === studentA)) {
    console.log(`   Student A queried subjects: saw ${subjectsA.length} own subject(s), 0 from Student B.`);
    console.log("✅ TEST 2 PASSED: Subjects isolated by student_id.\n");
  } else {
    throw new Error("❌ TEST 2 FAILED: Student A was able to see Student B's subjects!");
  }

  // =========================================================================
  // TEST 3: Student A cannot download Student B PDF (Step 530 Test 3)
  // =========================================================================
  console.log("--- TEST 3: Student A cannot download Student B PDF (IDOR Protection) ---");
  try {
    await axios.get(`${baseUrl}/api/storage/file?path=${studentB}/${subjB_CN.id}/CN_Exam_Student_B.pdf`, {
      headers: { Authorization: "Bearer token_student_A" }
    });
    throw new Error("❌ TEST 3 FAILED: Student A was able to download Student B's private storage file!");
  } catch (err) {
    if (err.response && err.response.status === 403) {
      console.log(`   Cross-student download blocked with HTTP 403: "${err.response.data.error}"`);
      console.log("✅ TEST 3 PASSED: Storage IDOR strictly defended.\n");
    } else {
      throw new Error(`❌ TEST 3 FAILED: Expected 403 Forbidden, received: ${err.message}`);
    }
  }

  // =========================================================================
  // TEST 4: Student A cannot retrieve Student B chunks (Step 530 Test 4)
  // =========================================================================
  console.log("--- TEST 4: Student A cannot retrieve Student B chunks ---");
  const crossChunkRes = await axios.post(
    `${baseUrl}/api/chat`,
    {
      question: "What is the secret handshake protocol key CIPHER_OMEGA_999 in my notes?",
      conversation_id: "conv_a_probe_b",
      mode: "learn"
    },
    { headers: { Authorization: "Bearer token_student_A" } }
  );

  const leakedStudentBData = crossChunkRes.data.answer.includes("CIPHER_OMEGA_999") ||
                             (crossChunkRes.data.sources && crossChunkRes.data.sources.some(s => s.resource_name.includes("Student_B")));

  if (!leakedStudentBData && crossChunkRes.data.answer.includes(MISSING_INFO_FALLBACK)) {
    console.log(`   Student A probe for Student B chunk returned: "${crossChunkRes.data.answer}"`);
    console.log("✅ TEST 4 PASSED: Vector chunks completely isolated between tenants.\n");
  } else {
    throw new Error("❌ TEST 4 FAILED: Cross-student vector chunk data leaked!");
  }

  // =========================================================================
  // TEST 5: Student A cannot see Student B chat (Step 530 Test 5)
  // =========================================================================
  console.log("--- TEST 5: Student A cannot see Student B chat history ---");
  try {
    await axios.get(`${baseUrl}/api/chat/history?conversation_id=${convB_Id}`, {
      headers: { Authorization: "Bearer token_student_A" }
    });
    throw new Error("❌ TEST 5 FAILED: Student A was able to read Student B's chat history!");
  } catch (err) {
    if (err.response && err.response.status === 403) {
      console.log(`   Cross-student chat access blocked with HTTP 403: "${err.response.data.error}"`);
      console.log("✅ TEST 5 PASSED: Conversation history strictly isolated by student_id.\n");
    } else {
      throw new Error(`❌ TEST 5 FAILED: Expected 403 Forbidden, received: ${err.message}`);
    }
  }

  // =========================================================================
  // TEST 6: OS search doesn't retrieve unrelated DBMS (Step 530 Test 6)
  // =========================================================================
  console.log("--- TEST 6: OS search doesn't retrieve unrelated DBMS ---");
  const crossSubjectRes = await axios.post(
    `${baseUrl}/api/chat`,
    {
      question: "What is dual-mode operation in operating systems?",
      subject_id: subjA_DBMS.id, // Scoped to DBMS, not OS!
      conversation_id: "conv_a_cross_subj",
      mode: "learn"
    },
    { headers: { Authorization: "Bearer token_student_A" } }
  );

  if (crossSubjectRes.data.answer.includes(MISSING_INFO_FALLBACK) && (!crossSubjectRes.data.sources || crossSubjectRes.data.sources.length === 0)) {
    console.log(`   OS query under DBMS scope returned fallback: "${crossSubjectRes.data.answer}"`);
    console.log("✅ TEST 6 PASSED: Subject boundary enforced without cross-subject pollution.\n");
  } else {
    throw new Error("❌ TEST 6 FAILED: OS query matched out-of-scope DBMS course notes!");
  }

  // =========================================================================
  // TEST 7: Unauthenticated API request is rejected (Step 530 Test 7)
  // =========================================================================
  console.log("--- TEST 7: Unauthenticated API request is rejected ---");
  process.env.STRICT_AUTH = "true";
  try {
    await axios.post(`${baseUrl}/api/chat`, {
      question: "What is dual-mode operation?"
    });
    throw new Error("❌ TEST 7 FAILED: Unauthenticated request was allowed through!");
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log(`   Rejected unauthenticated request with HTTP 401: "${err.response.data.error}"`);
      console.log("✅ TEST 7 PASSED: Missing auth token rejected with 401 Unauthorized.\n");
    } else {
      throw new Error(`❌ TEST 7 FAILED: Expected 401, got ${err.message}`);
    }
  } finally {
    delete process.env.STRICT_AUTH;
  }

  // =========================================================================
  // TEST 8: Invalid resource ownership is rejected (Step 530 Test 8)
  // =========================================================================
  console.log("--- TEST 8: Invalid resource ownership is rejected (Spoofing Defense) ---");
  try {
    await axios.post(
      `${baseUrl}/api/chat`,
      {
        student_id: studentB, // Attempting to spoof Student B with Student A's token
        question: "Show me notes",
        conversation_id: "conv_spoof_attempt"
      },
      { headers: { Authorization: "Bearer token_student_A" } }
    );
    throw new Error("❌ TEST 8 FAILED: Spoofed student_id was not rejected!");
  } catch (err) {
    if (err.response && err.response.status === 403) {
      console.log(`   Rejected client student spoofing with HTTP 403: "${err.response.data.error}"`);
      console.log("✅ TEST 8 PASSED: Client identity spoofing prevented.\n");
    } else {
      throw new Error(`❌ TEST 8 FAILED: Expected 403, got ${err.message}`);
    }
  }

  // =========================================================================
  // TEST 9: Missing information isn't fabricated (Step 530 Test 9)
  // =========================================================================
  console.log("--- TEST 9: Missing information isn't fabricated ---");
  const missingInfoRes = await axios.post(
    `${baseUrl}/api/chat`,
    {
      question: "Explain quantum physics according to my uploaded OS notes.",
      subject_id: subjA_OS.id,
      conversation_id: "conv_a_missing_info",
      mode: "learn"
    },
    { headers: { Authorization: "Bearer token_student_A" } }
  );

  if (missingInfoRes.data.answer === MISSING_INFO_FALLBACK && (!missingInfoRes.data.sources || missingInfoRes.data.sources.length === 0)) {
    console.log(`   Ungrounded topic returned strict fallback: "${missingInfoRes.data.answer}"`);
    console.log("✅ TEST 9 PASSED: Out-of-scope query cleanly returned honest fallback without hallucination.\n");
  } else {
    throw new Error("❌ TEST 9 FAILED: Agent fabricated an answer for ungrounded topic!");
  }

  // =========================================================================
  // TEST 10: Fake page numbers aren't invented (Step 530 Test 10)
  // =========================================================================
  console.log("--- TEST 10: Fake page numbers aren't invented ---");
  const fakePageRes = await axios.post(
    `${baseUrl}/api/chat`,
    {
      question: "What does page 999 of my PDF say?",
      subject_id: subjA_OS.id,
      conversation_id: "conv_a_fake_page",
      mode: "learn"
    },
    { headers: { Authorization: "Bearer token_student_A" } }
  );

  const answerText = fakePageRes.data.answer;
  const fabricatedPage = answerText.includes("Page 999 says") || 
                         (fakePageRes.data.sources && fakePageRes.data.sources.some(s => s.page_number === 999));

  if (!fabricatedPage && (answerText.includes("couldn't find page 999") || answerText.includes(MISSING_INFO_FALLBACK))) {
    console.log(`   Page 999 query returned honest response: "${answerText.slice(0, 100)}..."`);
    console.log("✅ TEST 10 PASSED: Fake page numbers are never invented.\n");
  } else {
    throw new Error("❌ TEST 10 FAILED: Agent invented content for non-existent page 999!");
  }

  console.log("==================================================================");
  console.log("🎉 ALL 10 STAGE 14 SECURITY & STUDENT ISOLATION TESTS PASSED!");
  console.log("==================================================================\n");
}

runStage14SecurityHardeningTests()
  .then(() => {
    if (server) server.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Stage 14 Test Suite Failed:", err);
    if (server) server.close();
    process.exit(1);
  });
