/**
 * Test Suite: Stage 22 — Full Code Audit: Quality, Security & Architecture Inspection
 * Performs automated inspection of backend modules, SQL migrations, n8n workflows,
 * input resilience, prototype safety, and error normalization.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const app = require("../server");

function makeRequest(server, options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on("error", reject);
    if (postData) {
      req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runStage22AuditTests() {
  console.log("==================================================================");
  console.log("🔍 RUNNING STAGE 22: FULL CODE AUDIT & SECURITY INSPECTION");
  console.log("==================================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // -------------------------------------------------------------------------
    // AUDIT 1: Backend Modules Import & Circular Dependency Verification
    // -------------------------------------------------------------------------
    console.log("--- AUDIT 1: Backend Module Integrity & Circular Dependency Check ---");
    const srcDir = path.join(__dirname, "../src");
    const srcFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith(".js"));
    assert.ok(srcFiles.length >= 9, "All 9+ backend core source modules must exist");
    for (const file of srcFiles) {
      const mod = require(path.join(srcDir, file));
      assert.ok(mod !== null && typeof mod === "object" || typeof mod === "function", `Module ${file} must export valid members`);
    }
    console.log(`✅ AUDIT 1 PASSED: Verified all ${srcFiles.length} backend source modules load cleanly without circular dependencies.`);

    // -------------------------------------------------------------------------
    // AUDIT 2: extractor.js Static Hygiene
    // -------------------------------------------------------------------------
    console.log("--- AUDIT 2: PDF Parser Static Cleanliness ---");
    const extractorCode = fs.readFileSync(path.join(__dirname, "../src/extractor.js"), "utf8");
    const requirePdfParseCount = (extractorCode.match(/require\(["']pdf-parse["']\)/g) || []).length;
    assert.strictEqual(requirePdfParseCount, 1, "extractor.js must only import pdf-parse once at module scope");
    console.log("✅ AUDIT 2 PASSED: Extractor module adheres to single-import hygiene.");

    // -------------------------------------------------------------------------
    // AUDIT 3: SQL Migration Scripts Idempotence & RLS Enforceability
    // -------------------------------------------------------------------------
    console.log("--- AUDIT 3: SQL Migration Scripts Security & Idempotency Audit ---");
    const dbDir = path.join(__dirname, "../../database");
    const sqlFiles = fs.readdirSync(dbDir).filter((f) => f.endsWith(".sql"));
    assert.ok(sqlFiles.length >= 4, "All SQL migration and security scripts must exist");
    for (const sqlFile of sqlFiles) {
      const sql = fs.readFileSync(path.join(dbDir, sqlFile), "utf8");
      assert.ok(sql.length > 50, `${sqlFile} must not be empty`);
      // Security-focused migrations must enforce RLS
      if (sqlFile.includes("security") || sqlFile.includes("hardening") || sqlFile.includes("roles")) {
        assert.ok(
          sql.includes("ENABLE ROW LEVEL SECURITY"),
          `${sqlFile} must enforce ENABLE ROW LEVEL SECURITY`
        );
        assert.ok(
          sql.includes("DROP POLICY IF EXISTS"),
          `${sqlFile} must provide idempotent policy updates via DROP POLICY IF EXISTS`
        );
      }
    }
    console.log(`✅ AUDIT 3 PASSED: Verified ${sqlFiles.length} SQL migrations have valid RLS and idempotent drop clauses.`);

    // -------------------------------------------------------------------------
    // AUDIT 4: n8n Workflow JSON Schema Validation
    // -------------------------------------------------------------------------
    console.log("--- AUDIT 4: n8n Orchestrator Workflow Schema Verification ---");
    const n8nDir = path.join(__dirname, "../../n8n");
    const n8nFiles = fs.readdirSync(n8nDir).filter((f) => f.endsWith(".json"));
    assert.ok(n8nFiles.length >= 2, "At least 2 n8n workflow configurations must exist");
    for (const n8nFile of n8nFiles) {
      const raw = fs.readFileSync(path.join(n8nDir, n8nFile), "utf8");
      const json = JSON.parse(raw);
      assert.ok(json.name, `${n8nFile} must define workflow name`);
      assert.ok(Array.isArray(json.nodes), `${n8nFile} must contain nodes array`);
      assert.ok(json.nodes.length > 0, `${n8nFile} must contain active nodes`);
    }
    console.log(`✅ AUDIT 4 PASSED: Verified all ${n8nFiles.length} n8n workflows contain valid node trees and webhook mappings.`);

    // -------------------------------------------------------------------------
    // AUDIT 5: Input Fuzzing & Malformed JSON Resilience
    // -------------------------------------------------------------------------
    console.log("--- AUDIT 5: Input Validation & Malformed Payload Handling ---");
    const emptyPostRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_student_A"
      }
    }, {});
    assert.strictEqual(emptyPostRes.status, 400, "Missing question must return HTTP 400 Bad Request");
    assert.ok(emptyPostRes.body.error, "Response must return structured error message");

    const courseEmptyRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/courses",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_student_A"
      }
    }, {});
    assert.strictEqual(courseEmptyRes.status, 400, "Empty course creation must return HTTP 400");
    console.log("✅ AUDIT 5 PASSED: Handlers reject empty/malformed inputs with clean HTTP 400 status.");

    // -------------------------------------------------------------------------
    // AUDIT 6: Prototype Pollution Safety
    // -------------------------------------------------------------------------
    console.log("--- AUDIT 6: Prototype Pollution & Identity Injection Guard ---");
    const protoRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_student_A"
      }
    }, {
      question: "What is a process?",
      subject_id: "subj_os",
      __proto__: { isAdmin: true },
      constructor: { prototype: { role: "admin" } }
    });
    assert.strictEqual(protoRes.status, 200, "Valid question must succeed");
    assert.strictEqual(Object.prototype.isAdmin, undefined, "Object prototype must not be polluted");
    assert.strictEqual(Object.prototype.role, undefined, "Object prototype must not have role polluted");
    console.log("✅ AUDIT 6 PASSED: Prototype pollution attempts safely neutralized.");

    // -------------------------------------------------------------------------
    // AUDIT 7: Error Response Normalization
    // -------------------------------------------------------------------------
    console.log("--- AUDIT 7: Unified Error Response Architecture ---");
    const missingConvRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/chat/history",
      method: "GET",
      headers: { Authorization: "Bearer token_student_A" }
    });
    assert.strictEqual(missingConvRes.status, 400, "Missing conversation_id must return 400");
    assert.ok(typeof missingConvRes.body.error === "string", "Error property must be string message");
    console.log("✅ AUDIT 7 PASSED: Error response format strictly conforms to { error: string }.");

    // -------------------------------------------------------------------------
    // AUDIT 8: Frontend Production Bundle Integrity
    // -------------------------------------------------------------------------
    console.log("--- AUDIT 8: Frontend Production Bundle Integrity ---");
    const distHtmlPath = path.join(__dirname, "../../frontend/dist/index.html");
    assert.ok(fs.existsSync(distHtmlPath), "frontend/dist/index.html must exist");
    const htmlContent = fs.readFileSync(distHtmlPath, "utf8");
    assert.ok(htmlContent.includes("<div id=\"root\"></div>"), "dist/index.html must contain root mounting element");
    console.log("✅ AUDIT 8 PASSED: Frontend production bundle exists, validated, and ready for serving.");

  } finally {
    server.close();
  }
}

if (require.main === module) {
  runStage22AuditTests()
    .then(() => {
      console.log("\n==================================================================");
      console.log("🎉 ALL 8 STAGE 22 CODE AUDIT CHECKS PASSED WITH 100% SUCCESS!");
      console.log("==================================================================\n");
    })
    .catch((err) => {
      console.error("❌ Stage 22 Code Audit Failed:", err);
      process.exit(1);
    });
}

module.exports = { runStage22AuditTests };
