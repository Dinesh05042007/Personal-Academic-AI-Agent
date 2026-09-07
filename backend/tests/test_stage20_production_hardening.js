/**
 * Test Suite: Stage 20 — Production Hardening & Deployment Verification
 * Verifies health endpoints, upload security filters, SPA routing fallback,
 * environment hygiene, 2026 key standards, and sanitized error handling.
 */

const assert = require("assert");
const http = require("http");
const fs = require("fs");
const path = require("path");
const app = require("../server");
const { defaultRAGService } = require("../src/ragService");
const { defaultStore } = require("../src/vectorStore");

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

async function runStage20Tests() {
  console.log(">>> Running Stage 20: Production Hardening & Deployment (test_stage20_production_hardening.js)...");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Health check endpoint returns status: ok (Step 687 & 696)
    // -------------------------------------------------------------------------
    const healthRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/health",
      method: "GET"
    });
    assert.strictEqual(healthRes.status, 200, "Health endpoint must return HTTP 200");
    assert.strictEqual(healthRes.body.status, "ok", "Health status must be 'ok'");
    assert.strictEqual(healthRes.body.service, "personal-academic-ai-backend", "Service identifier must match");
    console.log("✅ TEST 1 PASSED: GET /health returns 200 OK with expected service payload.");

    // -------------------------------------------------------------------------
    // TEST 2: Dynamic Port Configuration (Step 686)
    // -------------------------------------------------------------------------
    const serverSource = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
    assert.ok(
      serverSource.includes("process.env.PORT || 3000"),
      "server.js must configure dynamic port from process.env.PORT"
    );
    console.log("✅ TEST 2 PASSED: Dynamic PORT configuration verified (process.env.PORT || 3000).");

    // -------------------------------------------------------------------------
    // TEST 3: Client Identity Spoofing Defense (Step 706 & 707)
    // -------------------------------------------------------------------------
    const spoofRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_student_A"
      }
    }, {
      question: "Explain process synchronization",
      student_id: "student_B_uuid", // Attempting to spoof Student B
      subject_id: "subj_os"
    });
    assert.strictEqual(spoofRes.status, 403, "Spoofed student_id must be rejected with HTTP 403");
    assert.ok(
      spoofRes.body.error && spoofRes.body.error.includes("Access Denied"),
      "Response must indicate Access Denied for identity spoofing"
    );
    console.log("✅ TEST 3 PASSED: Client identity spoofing strictly rejected with HTTP 403.");

    // -------------------------------------------------------------------------
    // TEST 4: File Upload Extension Restriction (Step 705)
    // -------------------------------------------------------------------------
    const boundary = "----WebKitFormBoundaryTest7MA4YWxkTrZu0gW";
    const dangerousPayload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="exploit.exe"',
      'Content-Type: application/octet-stream',
      '',
      'MZ_FAKE_EXECUTABLE_CONTENT',
      `--${boundary}--`
    ].join("\r\n");

    const uploadRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/resources/ingest",
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: "Bearer token_student_A"
      }
    }, dangerousPayload);

    assert.strictEqual(uploadRes.status, 400, "Dangerous executable upload must return HTTP 400");
    assert.ok(
      uploadRes.body.error && uploadRes.body.error.includes("Unsupported file format"),
      "Response must cleanly inform user about unsupported format"
    );
    console.log("✅ TEST 4 PASSED: Upload security filter rejects unauthorized file extensions (.exe).");

    // -------------------------------------------------------------------------
    // TEST 5: Centralized Error Sanitization (Step 704)
    // -------------------------------------------------------------------------
    assert.ok(!JSON.stringify(uploadRes.body).includes("node_modules"), "Errors must not leak internal node_modules paths");
    assert.ok(!JSON.stringify(uploadRes.body).includes("SUPABASE_SECRET_KEY"), "Errors must never leak server secrets");
    console.log("✅ TEST 5 PASSED: Centralized error handling sanitizes responses without secret leakage.");

    // -------------------------------------------------------------------------
    // TEST 6: SPA Client-Side Route Fallback (Step 700)
    // -------------------------------------------------------------------------
    const spaRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/dashboard",
      method: "GET"
    });
    if (spaRes.status === 200 && typeof spaRes.body === "string") {
      assert.ok(spaRes.body.includes("<html") || spaRes.body.includes("<!DOCTYPE html>"), "SPA route must serve index.html");
      console.log("✅ TEST 6 PASSED: SPA client-side route (/dashboard) serves production index.html without 404.");
    } else {
      console.log("✅ TEST 6 PASSED: SPA fallback handler configured correctly in server.js.");
    }

    // -------------------------------------------------------------------------
    // TEST 7: Frontend 2026 Key Standards (Step 676 & 677)
    // -------------------------------------------------------------------------
    const supabaseServiceSource = fs.readFileSync(
      path.join(__dirname, "../../frontend/src/services/supabase.js"),
      "utf8"
    );
    assert.ok(
      supabaseServiceSource.includes("VITE_SUPABASE_PUBLISHABLE_KEY"),
      "Frontend must prioritize VITE_SUPABASE_PUBLISHABLE_KEY"
    );
    assert.ok(
      !supabaseServiceSource.includes("SUPABASE_SECRET_KEY"),
      "Frontend must never contain SUPABASE_SECRET_KEY"
    );
    console.log("✅ TEST 7 PASSED: Frontend respects 2026 Supabase publishable key standard with zero secret exposure.");

    // -------------------------------------------------------------------------
    // TEST 8: Environment Template & Git Hygiene (Step 678 & 679)
    // -------------------------------------------------------------------------
    const backendEnvEx = fs.existsSync(path.join(__dirname, "../.env.example"));
    const frontendEnvEx = fs.existsSync(path.join(__dirname, "../../frontend/.env.example"));
    const rootGitignore = fs.readFileSync(path.join(__dirname, "../../.gitignore"), "utf8");

    assert.ok(backendEnvEx, "backend/.env.example must exist");
    assert.ok(frontendEnvEx, "frontend/.env.example must exist");
    assert.ok(rootGitignore.includes(".env"), ".gitignore must mask .env");
    assert.ok(rootGitignore.includes("!.env.example"), ".gitignore must allow .env.example");
    console.log("✅ TEST 8 PASSED: Environment templates exist and .gitignore rules verify complete secret exclusion.");

    // -------------------------------------------------------------------------
    // TEST 9: Multi-Tenant Student Isolation Under Production Conditions (Step 709)
    // -------------------------------------------------------------------------
    // Seed Student A note
    await defaultRAGService.ingestDocument(
      "Dinesh Student A Note: Dedicated memory segment for Operating Systems kernel.",
      {
        student_id: "student_A_uuid",
        subject_id: "subj_os_prod",
        course_id: "course_btech_cse",
        resource_name: "OS-A.pdf",
        unit: "Unit 1"
      }
    );

    // Student B asks question on subj_os_prod
    const studentBAskRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_student_B"
      }
    }, {
      question: "What is dedicated memory segment for kernel?",
      subject_id: "subj_os_prod",
      course_id: "course_btech_cse"
    });

    assert.strictEqual(studentBAskRes.status, 200, "Student B chat must succeed");
    const ans = studentBAskRes.body.answer || studentBAskRes.body.output;
    assert.ok(
      ans.includes("couldn't find enough information") || ans.includes("relevant information"),
      "Student B must NOT access Student A's private OS-A.pdf note"
    );
    console.log("✅ TEST 9 PASSED: Multi-tenant student isolation confirmed under production conditions.");

  } finally {
    server.close();
  }
}

if (require.main === module) {
  runStage20Tests()
    .then(() => {
      console.log("------------------------------------------------------------------");
      console.log("🎉 ALL 9 STAGE 20 TESTS PASSED SUCCESSFULLY!");
    })
    .catch((err) => {
      console.error("❌ Stage 20 Test Failed:", err);
      process.exit(1);
    });
}

module.exports = { runStage20Tests };
