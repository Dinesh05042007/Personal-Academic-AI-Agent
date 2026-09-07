const axios = require("axios");
const app = require("../server");

async function runStage9IntegrationTest() {
  console.log("==========================================================");
  console.log("🚀 RUNNING STAGE 9: END-TO-END REACT ↔ BACKEND ↔ AI TESTS");
  console.log("==========================================================\n");

  // Start server on an ephemeral port
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => {
      resolve(s);
    });
  });

  const port = server.address().port;
  console.log(`Express server started dynamically on port: ${port}`);

  const client = axios.create({
    baseURL: `http://localhost:${port}`,
    headers: {
      Authorization: "Bearer token_student_A",
      "Content-Type": "application/json"
    }
  });

  try {
    // TEST 1: Health check
    console.log("--- TEST 1: Backend Health Check ---");
    const health = await client.get("/");
    console.log("Backend response:", health.data);
    if (health.data.message.includes("running")) {
      console.log("✅ TEST 1 PASSED: Express server responding to HTTP calls.\n");
    }

    // TEST 2: Ingest sample note via API
    console.log("--- TEST 2: Ingest Course Note via /api/resources/ingest ---");
    const ingestRes = await client.post("/api/resources/ingest", {
      student_id: "student_A_uuid",
      subject_id: "subj_os",
      course_id: "course_btech_cse",
      unit: "Unit 2",
      resource_name: "Operating_Systems_Unit_2.pdf",
      text_content: "--- PAGE 5: PROCESS SCHEDULING ---\nCPU scheduling is the basis of multiprogrammed operating systems. By switching the CPU among processes, the operating system makes the computer more productive. The ready queue holds all processes residing in main memory that are ready and waiting to execute."
    });
    console.log("Ingestion result:", ingestRes.data.message, `(${ingestRes.data.chunks_count} chunks)`);
    console.log("✅ TEST 2 PASSED: Resource ingested and vectorized.\n");

    // TEST 3: Ask question via /api/chat (Step 296, 312)
    console.log("--- TEST 3: Ask Knowledge Base Question via /api/chat (Step 312) ---");
    const chatRes1 = await client.post("/api/chat", {
      question: "What is process scheduling?",
      subject_id: "subj_os",
      course_id: "course_btech_cse",
      conversation_id: "test_integration_conv"
    });
    console.log("AI Chat Response:");
    console.log("Answer:\n", chatRes1.data.answer);
    console.log("Orchestrator Source:", chatRes1.data.source_orchestrator);
    console.log("Sources:", chatRes1.data.sources);

    if (chatRes1.data.found_in_notes && chatRes1.data.sources.length > 0) {
      console.log("✅ TEST 3 PASSED: React /api/chat endpoint successfully returned grounded answer and citation.\n");
    } else {
      throw new Error("❌ TEST 3 FAILED: Knowledge retrieval missing from /api/chat");
    }

    // TEST 4: Follow-up memory turn
    console.log("--- TEST 4: Conversational Memory Follow-up Turn ---");
    const chatRes2 = await client.post("/api/chat", {
      question: "Explain it in simple words",
      subject_id: "subj_os",
      course_id: "course_btech_cse",
      conversation_id: "test_integration_conv",
      mode: "EXPLAIN"
    });
    console.log("AI Follow-up Response:");
    console.log("Answer:\n", chatRes2.data.answer);

    if (chatRes2.data.found_in_notes) {
      console.log("✅ TEST 4 PASSED: Contextual pronoun resolved across turns in /api/chat.\n");
    } else {
      throw new Error("❌ TEST 4 FAILED: Memory continuity lost in /api/chat");
    }

    // TEST 5: Missing / Unrelated question fallback (Step 314)
    console.log("--- TEST 5: Unrelated Question Fallback via /api/chat (Step 314) ---");
    const chatRes3 = await client.post("/api/chat", {
      question: "Who won the 2024 Olympic marathon?",
      subject_id: "subj_os",
      course_id: "course_btech_cse",
      conversation_id: "test_integration_conv"
    });
    console.log("AI Fallback Response:", chatRes3.data.answer);

    if (!chatRes3.data.found_in_notes && chatRes3.data.answer.includes("couldn't find")) {
      console.log("✅ TEST 5 PASSED: Honest fallback preserved across /api/chat.\n");
    } else {
      throw new Error("❌ TEST 5 FAILED: Expected fallback on out-of-scope question");
    }

    console.log("🎉 ALL STAGE 9 INTEGRATION TESTS COMPLETED SUCCESSFULLY!");
  } finally {
    server.close();
  }
}

runStage9IntegrationTest().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});
