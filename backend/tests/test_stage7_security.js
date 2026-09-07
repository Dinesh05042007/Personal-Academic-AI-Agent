const { requireStudentAuth, registerDevToken } = require("../src/authMiddleware");
const { defaultRAGService, MISSING_INFO_FALLBACK } = require("../src/ragService");
const { defaultAgentOrchestrator } = require("../src/agentOrchestrator");

async function runStage7SecurityTests() {
  console.log("=============================================================");
  console.log("🔒 RUNNING STAGE 7: STUDENT ISOLATION & TENANT SECURITY TESTS");
  console.log("=============================================================\n");

  const studentA = "student_A_uuid";
  const studentB = "student_B_uuid";

  registerDevToken("token_student_A", { id: studentA, student_id: studentA, email: "student_a@college.edu" });
  registerDevToken("token_student_B", { id: studentB, student_id: studentB, email: "student_b@college.edu" });

  // 1. Ingest notes for Student A
  console.log("1. Ingesting private course notes for Student A...");
  await defaultRAGService.ingestDocument(
    "Operating Systems Architecture: Student A's private exam notes state that the critical kernel design formula is ALPHA_77.",
    {
      student_id: studentA,
      course_id: "cse_course",
      subject_id: "os_subject",
      resource_name: "OS_Student_A.pdf",
      unit: "Unit 1"
    }
  );
  console.log("   ✅ Student A notes ingested.\n");

  // 2. Ingest notes for Student B
  console.log("2. Ingesting private course notes for Student B...");
  await defaultRAGService.ingestDocument(
    "Computer Networks Architecture: Student B's private exam notes state that the secret protocol parameter is BETA_99.",
    {
      student_id: studentB,
      course_id: "cse_course",
      subject_id: "cn_subject",
      resource_name: "CN_Student_B.pdf",
      unit: "Unit 1"
    }
  );
  console.log("   ✅ Student B notes ingested.\n");

  // TEST 1: Student A querying own material
  console.log("--- TEST 1: Student A Querying Own Material (Step 248) ---");
  const resA = await defaultAgentOrchestrator.processUserMessage({
    student_id: studentA,
    conversation_id: "conv_a_" + Date.now(),
    question: "What is the critical kernel design formula in my notes?"
  });
  console.log(`Student A Query: "What is the critical kernel design formula in my notes?"`);
  console.log(`Answer:\n${resA.answer}`);
  console.log(`Sources: ${resA.sources.map((s) => s.resource_name).join(", ")}`);
  if (resA.answer.includes("ALPHA_77") && !resA.answer.includes("BETA_99")) {
    console.log("✅ TEST 1 PASSED: Student A accurately retrieved own materials.\n");
  } else {
    throw new Error("❌ TEST 1 FAILED: Student A failed to retrieve own materials");
  }

  // TEST 2: Student B querying own material
  console.log("--- TEST 2: Student B Querying Own Material (Step 248) ---");
  const resB = await defaultAgentOrchestrator.processUserMessage({
    student_id: studentB,
    conversation_id: "conv_b_" + Date.now(),
    question: "What is the secret protocol parameter in my notes?"
  });
  console.log(`Student B Query: "What is the secret protocol parameter in my notes?"`);
  console.log(`Answer:\n${resB.answer}`);
  console.log(`Sources: ${resB.sources.map((s) => s.resource_name).join(", ")}`);
  if (resB.answer.includes("BETA_99") && !resB.answer.includes("ALPHA_77")) {
    console.log("✅ TEST 2 PASSED: Student B accurately retrieved own materials.\n");
  } else {
    throw new Error("❌ TEST 2 FAILED: Student B failed to retrieve own materials");
  }

  // TEST 3: Cross-tenant data leak prevention (Student A asks for Student B's data)
  console.log("--- TEST 3: Cross-Tenant Privacy Leak Prevention (Step 249) ---");
  const crossQuery = await defaultAgentOrchestrator.processUserMessage({
    student_id: studentA, // Authenticated as Student A
    conversation_id: "conv_cross_" + Date.now(),
    question: "What is the secret protocol parameter BETA_99 from the networks notes?",
    subject_id: "cn_subject"
  });
  console.log(`Student A querying Student B's secret topic: "What is the secret protocol parameter BETA_99?"`);
  console.log(`Found in Student A notes: ${crossQuery.found_in_notes}`);
  console.log(`Sources returned to Student A: ${JSON.stringify(crossQuery.sources)}`);
  console.log(`Answer given to Student A: "${crossQuery.answer}"`);

  const studentBDataLeaked = crossQuery.sources.some((s) => s.resource_name.includes("CN_Student_B")) || crossQuery.answer.includes("BETA_99");

  if (!studentBDataLeaked && !crossQuery.found_in_notes && crossQuery.answer === MISSING_INFO_FALLBACK) {
    console.log("✅ TEST 3 PASSED: Zero data leakage. Student A was completely blocked from accessing Student B's notes.\n");
  } else {
    throw new Error("❌ TEST 3 FAILED: Security breach! Student A accessed Student B's data");
  }

  // TEST 4: Middleware Spoofing Prevention (Step 224)
  console.log("--- TEST 4: Client Student ID Spoofing Prevention (Step 224) ---");
  let spoofBlocked = false;
  const mockReq = {
    headers: { authorization: "Bearer token_student_A" }, // Authenticated as Student A
    body: { student_id: studentB, question: "Steal notes" } // Attempting to spoof Student B
  };
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        if (code === 403) {
          spoofBlocked = true;
          console.log(`   Blocked with HTTP 403: ${data.error}`);
        }
      }
    })
  };
  await requireStudentAuth(mockReq, mockRes, () => {});

  if (spoofBlocked) {
    console.log("✅ TEST 4 PASSED: Middleware actively blocked client spoofing attempt.\n");
  } else {
    throw new Error("❌ TEST 4 FAILED: Spoofed student_id was not blocked");
  }

  console.log("🎉 ALL STAGE 7 SECURITY & TENANT ISOLATION TESTS PASSED!");
}

runStage7SecurityTests().catch((err) => {
  console.error("Security test failed:", err);
  process.exit(1);
});
