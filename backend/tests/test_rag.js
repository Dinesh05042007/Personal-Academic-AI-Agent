const path = require("path");
const fs = require("fs");
const { RAGService, MISSING_INFO_FALLBACK } = require("../src/ragService");
const { VectorStore } = require("../src/vectorStore");

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING STAGE 4 RAG & KNOWLEDGE PIPELINE TESTS");
  console.log("=================================================\n");

  const testStorePath = path.join(__dirname, "test_vector_store.json");
  if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);

  const testStore = new VectorStore(testStorePath);
  const rag = new RAGService(testStore);

  // Setup test documents
  const sampleNotePath = path.join(__dirname, "../../documents/student123/semester3/operating-systems/Unit_2_Process_Scheduling.txt");
  
  console.log("1. Ingesting Student A (student123) Operating Systems notes...");
  const ingestA = await rag.ingestDocument(sampleNotePath, {
    student_id: "student123",
    course_id: "btech_cse",
    subject_id: "operating_systems",
    resource_name: "Unit_2_Process_Scheduling.txt",
    unit: "Unit 2"
  });
  console.log(`   ✅ Ingested ${ingestA.chunks_count} chunks across ${ingestA.pages_count} pages.\n`);

  console.log("2. Ingesting Student B (student456) C# Programming notes...");
  const studentBNotes = `COURSE: B.Tech CSE\nSUBJECT: C# Programming (CS302)\nUNIT: Unit 1 - C# Syntax\n--- PAGE 1: C# BASICS\nC# is an object-oriented language developed by Microsoft running on the .NET CLR. Generics provide type safety and code reusability without performance overhead.`;
  await rag.ingestDocument(studentBNotes, {
    student_id: "student456",
    course_id: "btech_cse",
    subject_id: "csharp_programming",
    resource_name: "CSharp_Unit1_Generics.txt",
    unit: "Unit 1"
  });
  console.log("   ✅ Student B notes ingested.\n");

  // TEST 1: Exact wording (Step 156)
  console.log("--- TEST 1: Exact Wording Retrieval (Step 156) ---");
  const q1 = "What is CPU scheduling?";
  const res1 = await rag.queryKnowledge(q1, {
    student_id: "student123",
    subject_id: "operating_systems"
  });
  console.log(`Query: "${q1}"`);
  console.log(`Found in notes: ${res1.found_in_notes}`);
  console.log(`Top Source: ${res1.sources[0]?.resource_name} (Page ${res1.sources[0]?.page_number})`);
  console.log(`Similarity: ${res1.sources[0]?.similarity}`);
  if (res1.found_in_notes && res1.sources[0]?.resource_name === "Unit_2_Process_Scheduling.txt") {
    console.log("✅ TEST 1 PASSED: Exact phrase retrieved correct document chunk.\n");
  } else {
    throw new Error("❌ TEST 1 FAILED");
  }

  // TEST 2: Semantic / Different wording (Step 157)
  console.log("--- TEST 2: Semantic / Different Wording Retrieval (Step 157) ---");
  const q2 = "How does the OS decide which process runs next?";
  const res2 = await rag.queryKnowledge(q2, {
    student_id: "student123",
    subject_id: "operating_systems"
  });
  console.log(`Query: "${q2}"`);
  console.log(`Found in notes: ${res2.found_in_notes}`);
  console.log(`Top Source: ${res2.sources[0]?.resource_name} (Page ${res2.sources[0]?.page_number})`);
  console.log(`Similarity: ${res2.sources[0]?.similarity}`);
  if (res2.found_in_notes && res2.sources[0]?.similarity > 0.4) {
    console.log("✅ TEST 2 PASSED: Semantic search identified concept despite different wording.\n");
  } else {
    throw new Error("❌ TEST 2 FAILED");
  }

  // TEST 3: Wrong subject filter boundary (Step 158)
  console.log("--- TEST 3: Subject Boundary Filtering (Step 158) ---");
  const q3 = "What is CPU scheduling?";
  const res3 = await rag.queryKnowledge(q3, {
    student_id: "student123",
    subject_id: "csharp_programming" // Filtering for C# when querying OS
  });
  console.log(`Query: "${q3}" with filter subject_id="csharp_programming"`);
  console.log(`Matches found: ${res3.sources.length}`);
  console.log(`Answer fallback: "${res3.answer}"`);
  if (!res3.found_in_notes && res3.sources.length === 0) {
    console.log("✅ TEST 3 PASSED: Subject filter properly prevented cross-subject leakage.\n");
  } else {
    throw new Error("❌ TEST 3 FAILED: Chunks leaked across subject filter");
  }

  // TEST 4: Student Isolation & Privacy (Step 159)
  console.log("--- TEST 4: Student Isolation & Privacy Boundary (Step 159) ---");
  const q4 = "What are C# Generics and CLR?";
  const res4 = await rag.queryKnowledge(q4, {
    student_id: "student123" // Student A asking for Student B's material
  });
  console.log(`Student A querying Student B's topic: "${q4}"`);
  console.log(`Found in Student A's notes: ${res4.found_in_notes}`);
  console.log(`Sources returned to Student A: ${JSON.stringify(res4.sources)}`);
  if (!res4.found_in_notes && res4.sources.length === 0) {
    console.log("✅ TEST 4 PASSED: Student A cannot access Student B's resources.\n");
  } else {
    throw new Error("❌ TEST 4 FAILED: Privacy breach, Student A accessed Student B's data!");
  }

  // TEST 5: Missing / Unrelated question fallback (Step 154)
  console.log("--- TEST 5: Missing Information & Fallback Behavior (Step 154) ---");
  const q5 = "Who won the cricket world championship in 2023?";
  const res5 = await rag.queryKnowledge(q5, {
    student_id: "student123"
  });
  console.log(`Query: "${q5}"`);
  console.log(`Answer: "${res5.answer}"`);
  if (res5.answer === MISSING_INFO_FALLBACK && !res5.found_in_notes) {
    console.log("✅ TEST 5 PASSED: System returned honest 'don't know' fallback without hallucinating.\n");
  } else {
    throw new Error("❌ TEST 5 FAILED: Expected strict missing information fallback");
  }

  // Clean up test store
  if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);

  console.log("🎉 ALL STAGE 4 RAG TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
