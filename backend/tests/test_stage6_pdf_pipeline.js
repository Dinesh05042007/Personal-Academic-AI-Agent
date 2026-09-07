const path = require("path");
const { defaultRAGService, MISSING_INFO_FALLBACK } = require("../src/ragService");
const { defaultAgentOrchestrator } = require("../src/agentOrchestrator");

async function runStage6Verification() {
  console.log("=======================================================");
  console.log("📄 RUNNING STAGE 6: PDF → KNOWLEDGE BASE INGESTION TEST");
  console.log("=======================================================\n");

  const pdfPath = path.join(__dirname, "../../documents/Operating_Systems_Unit_1.pdf");
  const studentId = "student_001";
  const conversationId = "conv_stage6_" + Date.now();

  console.log("1. Ingesting binary PDF: Operating_Systems_Unit_1.pdf...");
  const ingestResult = await defaultRAGService.ingestDocument(pdfPath, {
    student_id: studentId,
    course_id: "CSE_2026",
    subject_id: "OS",
    unit: "Unit 1",
    resource_name: "Operating Systems Unit 1.pdf",
    mimeType: "application/pdf"
  });

  console.log(`   ✅ Ingestion Complete: ${ingestResult.pages_count} pages extracted into ${ingestResult.chunks_count} vector chunks.\n`);

  if (ingestResult.pages_count !== 3) {
    throw new Error(`❌ Expected 3 pages extracted from PDF, got ${ingestResult.pages_count}`);
  }

  // STEP 217 TEST: Question definitely in the PDF
  console.log("--- STEP 217 TEST: Exact Concept in PDF ---");
  const q1 = "What is a process?";
  const res1 = await defaultAgentOrchestrator.processUserMessage({
    student_id: studentId,
    conversation_id: conversationId,
    question: q1,
    subject_id: "OS"
  });

  console.log(`Question: "${q1}"`);
  console.log(`Answer:\n${res1.answer}`);
  console.log(`Source File: ${res1.sources[0]?.resource_name}`);
  console.log(`Page Number: ${res1.sources[0]?.page_number}`);
  console.log(`Similarity: ${res1.sources[0]?.similarity}`);

  if (!res1.found_in_notes || res1.sources[0]?.page_number !== 3) {
    throw new Error("❌ STEP 217 FAILED: Process concept should map directly to Page 3 of PDF");
  }
  console.log("✅ STEP 217 PASSED: Successfully retrieved concept from Page 3.\n");

  // STEP 218 TEST: Different wording test
  console.log("--- STEP 218 TEST: Different Wording Semantic Match ---");
  const q2 = "Explain what a process means in an operating system";
  const res2 = await defaultAgentOrchestrator.processUserMessage({
    student_id: studentId,
    conversation_id: conversationId,
    question: q2,
    subject_id: "OS"
  });

  console.log(`Question: "${q2}"`);
  console.log(`Found in notes: ${res2.found_in_notes}`);
  console.log(`Top match: ${res2.sources[0]?.resource_name} (Page ${res2.sources[0]?.page_number})`);

  if (!res2.found_in_notes) {
    throw new Error("❌ STEP 218 FAILED: Semantic search did not find matching chunk");
  }
  console.log("✅ STEP 218 PASSED: Semantic match succeeded despite alternate phrasing.\n");

  // STEP 219 TEST: Source Citation Behavior
  console.log("--- STEP 219 TEST: Source Citation Integrity ---");
  const source = res1.sources[0];
  console.log(`Document Name: "${source.resource_name}"`);
  console.log(`Page: ${source.page_number}`);
  if (source.resource_name === "Operating Systems Unit 1.pdf" && source.page_number === 3) {
    console.log("✅ STEP 219 PASSED: Citation accurately reflects document name and actual page without fabricating.\n");
  } else {
    throw new Error("❌ STEP 219 FAILED: Incorrect citation data");
  }

  // STEP 220 TEST: Question NOT in PDF
  console.log("--- STEP 220 TEST: Missing Knowledge Fallback ---");
  const q3 = "What does the material say about cellular mitosis in biology?";
  const res3 = await defaultAgentOrchestrator.processUserMessage({
    student_id: studentId,
    conversation_id: conversationId,
    question: q3,
    subject_id: "OS"
  });

  console.log(`Question: "${q3}"`);
  console.log(`Answer: "${res3.answer}"`);

  if (res3.answer === MISSING_INFO_FALLBACK && !res3.found_in_notes) {
    console.log("✅ STEP 220 PASSED: Agent returned clean fallback without hallucinating.\n");
  } else {
    throw new Error("❌ STEP 220 FAILED: Agent hallucinated on non-existent topic");
  }

  console.log("🎉 ALL STAGE 6 PDF INGESTION & RETRIEVAL CHECKS PASSED!");
}

runStage6Verification().catch((err) => {
  console.error("Stage 6 test failed:", err);
  process.exit(1);
});
