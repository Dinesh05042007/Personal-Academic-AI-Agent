const { defaultAgentOrchestrator } = require("../src/agentOrchestrator");
const { defaultRAGService, MISSING_INFO_FALLBACK } = require("../src/ragService");
const path = require("path");

async function runStage5Tests() {
  console.log("=================================================");
  console.log("🤖 RUNNING STAGE 5 n8n AI AGENT LOGIC & MEMORY TESTS");
  console.log("=================================================\n");

  const studentId = "student_stage5";
  const conversationId = "conv_" + Date.now();

  // Ensure notes are ingested for this student
  const sampleNotePath = path.join(__dirname, "../../documents/student123/semester3/operating-systems/Unit_2_Process_Scheduling.txt");
  await defaultRAGService.ingestDocument(sampleNotePath, {
    student_id: studentId,
    course_id: "btech_cse",
    subject_id: "operating_systems",
    resource_name: "Operating_Systems_Unit_2.pdf",
    unit: "Unit 2"
  });
  console.log("✅ Stage 5 sample course notes indexed in student knowledge base.\n");

  // TEST 1: Initial Question (Step 186)
  console.log("--- TEST 1: Agent Knowledge Retrieval (Step 186) ---");
  const turn1 = await defaultAgentOrchestrator.processUserMessage({
    student_id: studentId,
    conversation_id: conversationId,
    question: "What is process scheduling?",
    subject_id: "operating_systems"
  });

  console.log(`User: "What is process scheduling?"`);
  console.log(`AI Answer:\n${turn1.answer}`);
  console.log(`Source Document: ${turn1.sources[0]?.resource_name} (Page ${turn1.sources[0]?.page_number})`);

  if (!turn1.found_in_notes || turn1.sources.length === 0) {
    throw new Error("❌ TEST 1 FAILED: Agent failed to retrieve student notes");
  }
  console.log("✅ TEST 1 PASSED: Agent successfully queried knowledge base and answered.\n");

  // TEST 2: Conversational Memory (Step 182)
  console.log("--- TEST 2: Conversational Memory Continuity (Step 182) ---");
  const turn2 = await defaultAgentOrchestrator.processUserMessage({
    student_id: studentId,
    conversation_id: conversationId,
    question: "Explain it in simple words",
    mode: "EXPLAIN"
  });

  console.log(`User: "Explain it in simple words"`);
  console.log(`AI Answer:\n${turn2.answer}`);
  console.log(`Context successfully resolved to previous topic: ${turn2.found_in_notes}`);

  if (!turn2.found_in_notes) {
    throw new Error("❌ TEST 2 FAILED: Agent lost conversational context for pronoun reference 'it'");
  }
  console.log("✅ TEST 2 PASSED: Conversational memory successfully maintained topic continuity.\n");

  // TEST 3: Unrelated / Missing Knowledge Test (Step 189)
  console.log("--- TEST 3: Unrelated Question Fallback (Step 189) ---");
  const turn3 = await defaultAgentOrchestrator.processUserMessage({
    student_id: studentId,
    conversation_id: conversationId,
    question: "Explain quantum entanglement in astrophysics"
  });

  console.log(`User: "Explain quantum entanglement in astrophysics"`);
  console.log(`AI Answer: "${turn3.answer}"`);

  if (turn3.answer !== MISSING_INFO_FALLBACK || turn3.found_in_notes) {
    throw new Error("❌ TEST 3 FAILED: Agent should have rejected question not in notes");
  }
  console.log("✅ TEST 3 PASSED: Agent correctly responded with honest missing information fallback.\n");

  // TEST 4: Exam Mode Structure
  console.log("--- TEST 4: Exam Mode Structure ---");
  const turn4 = await defaultAgentOrchestrator.processUserMessage({
    student_id: studentId,
    conversation_id: conversationId,
    question: "Give me a 10-mark answer on deadlock conditions",
    mode: "EXAM"
  });

  console.log(`User: "Give me a 10-mark answer on deadlock conditions"`);
  console.log(`AI Answer:\n${turn4.answer}`);

  if (!turn4.answer.includes("Exam Preparation Summary") || !turn4.found_in_notes) {
    throw new Error("❌ TEST 4 FAILED: Exam mode did not produce structured output");
  }
  console.log("✅ TEST 4 PASSED: Exam mode output generated with full structured headings.\n");

  console.log("🎉 ALL STAGE 5 n8n AI AGENT LOGIC TESTS COMPLETED SUCCESSFULLY!");
}

runStage5Tests().catch((err) => {
  console.error("Stage 5 test failed:", err);
  process.exit(1);
});
