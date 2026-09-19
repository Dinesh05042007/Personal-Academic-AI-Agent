/**
 * Test Suite: Stage 24 — Strict Authentication & Tenant Isolation Verification
 *
 * Covers the required security behavior:
 *  1.  Valid dev token -> succeeds
 *  2.  Missing Authorization header -> 401
 *  3.  Empty Bearer token -> 401
 *  4.  Malformed Bearer header -> 401
 *  5.  Invalid (unknown) token -> 401
 *  6.  Missing token + spoofed student_id -> 401 (never an auto-created identity)
 *  7.  Authenticated Student A + spoofed Student B id -> 403
 *  8.  Dev-token request cannot mutate the stored token object
 *  9.  "student_A_uuid_evil" must not match owner "student_A_uuid" * 10. Student A cannot access Student B's profile/resources
 * 11. Student B cannot modify Student A's profile/photo/resources
 * 12. Production mode: dev tokens disabled, everything unauthorized -> 401
 * 13. Profile-photo stream route is authenticated and tenant-isolated
 *     (review regression: /api/storage/profile-photo sits behind requireStudentAuth)
 */

const assert = require("assert");
const http = require("http");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const app = require("../server");
const {
  registerDevToken,
  devUserTokens,
  verifyStudentResourceOwnership
} = require("../src/authMiddleware");
const { defaultStorageService } = require("../src/storageService");
const { defaultAcademicStore } = require("../src/academicStore");

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

async function runStage24Tests() {
  console.log("==================================================================");
  console.log("🔒 RUNNING STAGE 24: STRICT AUTH & TENANT ISOLATION TESTS");
  console.log("==================================================================\n");

  const studentA = "student_A_uuid";
  const studentB = "student_B_uuid";

  // Registered dev tokens for this suite (allowed outside production)
  registerDevToken("token_stage24_A", { id: studentA, student_id: studentA, email: "a@college.edu", name: "Student A" });
  registerDevToken("token_stage24_B", { id: studentB, student_id: studentB, email: "b@college.edu", name: "Student B" });
  // Roleless token: verifies per-request clone semantics (CASE 8)
  registerDevToken("token_stage24_roleless", { id: "roleless_uuid", student_id: "roleless_uuid", email: "r@college.edu" });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = { hostname: "localhost", port };

  try {
    // -------------------------------------------------------------------------
    // CASE 1: Valid dev token succeeds
    // -------------------------------------------------------------------------
    const meRes = await makeRequest(server, {
      ...base,
      path: "/api/auth/me",
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_A" }
    });
    assert.strictEqual(meRes.status, 200, "Valid dev token must authenticate successfully");
    assert.strictEqual(meRes.body.user.student_id, studentA, "Identity must come from the registered dev token");
    assert.strictEqual(meRes.body.user.role, "student", "Role default must be applied to the per-request clone");
    console.log("✅ CASE 1 PASSED: Valid dev token authenticates with correct identity.");

    // -------------------------------------------------------------------------
    // CASE 2: Missing Authorization header -> 401
    // -------------------------------------------------------------------------
    const noAuthRes = await makeRequest(server, { ...base, path: "/api/student/courses", method: "GET" });
    assert.strictEqual(noAuthRes.status, 401, "Missing Authorization header must return 401");
    console.log("✅ CASE 2 PASSED: Missing Authorization header rejected with 401.");

    // -------------------------------------------------------------------------
    // CASE 3: Empty Bearer token -> 401
    // -------------------------------------------------------------------------
    const emptyBearerRes = await makeRequest(server, {
      ...base,
      path: "/api/student/courses",
      method: "GET",
      headers: { Authorization: "Bearer " }
    });
    assert.strictEqual(emptyBearerRes.status, 401, "Empty Bearer token must return 401");
    console.log("✅ CASE 3 PASSED: Empty Bearer token rejected with 401.");

    // -------------------------------------------------------------------------
    // CASE 4: Malformed Bearer header -> 401
    // -------------------------------------------------------------------------
    const malformedRes = await makeRequest(server, {
      ...base,
      path: "/api/student/courses",
      method: "GET",
      headers: { Authorization: "Bearer" }
    });
    assert.strictEqual(malformedRes.status, 401, "'Authorization: Bearer' with no token must return 401");

    const lowerSchemeRes = await makeRequest(server, {
      ...base,
      path: "/api/student/courses",
      method: "GET",
      headers: { Authorization: "bearer token_stage24_A" }
    });
    assert.strictEqual(lowerSchemeRes.status, 401, "Lowercase 'bearer' scheme must be rejected as malformed");
    console.log("✅ CASE 4 PASSED: Malformed Authorization headers rejected with 401.");

    // -------------------------------------------------------------------------
    // CASE 5: Invalid (unknown) token -> 401
    // -------------------------------------------------------------------------
    const invalidRes = await makeRequest(server, {
      ...base,
      path: "/api/student/courses",
      method: "GET",
      headers: { Authorization: "Bearer totally_fake_token_123" }
    });
    assert.strictEqual(invalidRes.status, 401, "Unknown token must return 401");
    console.log("✅ CASE 5 PASSED: Invalid token rejected with 401.");

    // -------------------------------------------------------------------------
    // CASE 6: Missing token + spoofed student_id -> 401 (no auto identity)
    // -------------------------------------------------------------------------
    const spoofNoAuthRes = await makeRequest(server, {
      ...base,
      path: "/api/student/courses?student_id=" + studentB,
      method: "GET"
    });
    assert.strictEqual(spoofNoAuthRes.status, 401, "Unauthenticated request with spoofed student_id must return 401, never 200");
    console.log("✅ CASE 6 PASSED: Missing token + spoofed student_id rejected with 401 (identity never derived from client input).");

    // -------------------------------------------------------------------------
    // CASE 7: Authenticated Student A + spoofed Student B id -> 403
    // -------------------------------------------------------------------------
    const spoofRes = await makeRequest(server, {
      ...base,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_stage24_A"
      }
    }, { question: "Show me Student B notes", student_id: studentB });
    assert.strictEqual(spoofRes.status, 403, "Conflicting client student_id must return 403");
    console.log("✅ CASE 7 PASSED: Authenticated user spoofing another student rejected with 403.");

    // -------------------------------------------------------------------------
    // CASE 8: Dev-token request cannot mutate the stored token object
    // -------------------------------------------------------------------------
    const storedBefore = devUserTokens.get("token_stage24_roleless");
    const snapshotBefore = JSON.stringify(storedBefore);
    assert.strictEqual(storedBefore.role, undefined, "Precondition: registered token has no role");

    const rolelessRes = await makeRequest(server, {
      ...base,
      path: "/api/student/courses",
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_roleless" }
    });
    assert.strictEqual(rolelessRes.status, 200, "Roleless dev token request must succeed");

    const storedAfter = devUserTokens.get("token_stage24_roleless");
    assert.strictEqual(JSON.stringify(storedAfter), snapshotBefore, "Stored dev-token object must not be mutated by requests");
    assert.strictEqual(storedAfter.role, undefined, "Stored token must still have no role (req.user is a clone)");
    console.log("✅ CASE 8 PASSED: req.user is a clone — shared dev-token object never mutated.");

    // -------------------------------------------------------------------------
    // CASE 9: Exact resource ownership matching
    // -------------------------------------------------------------------------
    assert.strictEqual(
      verifyStudentResourceOwnership(studentA, studentA + "/subj_os/notes.pdf"),
      true,
      "Legitimate nested path must be accepted"
    );
    assert.strictEqual(
      verifyStudentResourceOwnership(studentA, "student_A_uuid_evil/subj_os/notes.pdf"),
      false,
      "Superstring student id prefix must be rejected"
    );
    assert.strictEqual(
      verifyStudentResourceOwnership(studentA, studentB + "/subj_cn/notes.pdf"),
      false,
      "Another student's path must be rejected"
    );
    assert.strictEqual(
      verifyStudentResourceOwnership(studentA, "../" + studentB + "/secrets.pdf"),
      false,
      "Traversal path must be rejected"
    );
    assert.strictEqual(
      verifyStudentResourceOwnership(studentA, studentA + "\\..\\secret.pdf"),
      false,
      "Backslash-aliased path must be rejected"
    );
    assert.strictEqual(verifyStudentResourceOwnership("", "file.pdf"), false, "Empty student id must be rejected");
    assert.strictEqual(verifyStudentResourceOwnership(studentA, ""), false, "Empty path must be rejected");
    console.log("✅ CASE 9 PASSED: Ownership matching is exact — 'student_A_uuid_evil' never matches 'student_A_uuid'.");

    // -------------------------------------------------------------------------
    // CASE 10: Student A cannot access Student B's profile/resources
    // -------------------------------------------------------------------------
    const profileA = await makeRequest(server, {
      ...base,
      path: "/api/student/profile",
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_A" }
    });
    assert.strictEqual(profileA.status, 200);
    assert.strictEqual(profileA.body.profile.student_id, studentA, "Student A must only ever receive their own profile");

    const profileB = await makeRequest(server, {
      ...base,
      path: "/api/student/profile",
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_B" }
    });
    assert.strictEqual(profileB.body.profile.student_id, studentB, "Student B must only ever receive their own profile");

    const crossProfileRes = await makeRequest(server, {
      ...base,
      path: "/api/student/profile?student_id=" + studentB,
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_A" }
    });
    assert.strictEqual(crossProfileRes.status, 403, "Student A querying Student B's profile must be rejected with 403");

    // Private storage: seed a file for Student B, then A tries to download it
    defaultStorageService.saveFile(studentB, "subj_stage24", "B_secret.pdf", Buffer.from("STUDENT B CONFIDENTIAL"));
    const crossDownloadRes = await makeRequest(server, {
      ...base,
      path: `/api/storage/file?path=${studentB}/subj_stage24/B_secret.pdf`,
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_A" }
    });
    assert.strictEqual(crossDownloadRes.status, 403, "Student A must not download Student B's file (expect 403)");

    // Even a superstring-prefixed path must not pass the ownership check over HTTP
    const evilPathRes = await makeRequest(server, {
      ...base,
      path: `/api/storage/file?path=${studentA}_evil/subj/B_file.pdf`,
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_A" }
    });
    assert.strictEqual(evilPathRes.status, 403, "Evil-prefixed storage path must be rejected (expect 403)");
    console.log("✅ CASE 10 PASSED: Student A cannot access Student B's profile or resources.");

    // -------------------------------------------------------------------------
    // CASE 11: Student B cannot modify Student A's profile/photo/resources
    // -------------------------------------------------------------------------
    const crossModifyRes = await makeRequest(server, {
      ...base,
      path: "/api/student/profile",
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_stage24_B"
      }
    }, { student_id: studentA, name: "HACKED BY B" });
    assert.strictEqual(crossModifyRes.status, 403, "Student B spoofing Student A's id on profile update must be rejected with 403");

    const crossPhotoRes = await makeRequest(server, {
      ...base,
      path: "/api/student/profile/photo",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_stage24_B"
      }
    }, { student_id: studentA });
    assert.strictEqual(crossPhotoRes.status, 403, "Student B spoofing Student A's id on photo upload must be rejected with 403 (before multer)");

    const nameBeforeB = profileB.body.profile.name;

    // B updates their own profile; A's profile must remain untouched
    await makeRequest(server, {
      ...base,
      path: "/api/student/profile",
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_stage24_B"
      }
    }, { name: "Student B Renamed" });

    const profileAAgain = await makeRequest(server, {
      ...base,
      path: "/api/student/profile",
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_A" }
    });
    assert.notStrictEqual(profileAAgain.body.profile.name, "HACKED BY B", "Student A's profile must never be modified by Student B");
    assert.strictEqual(profileAAgain.body.profile.name, profileA.body.profile.name, "Student A's profile name must be unchanged after B's activity");
    assert.strictEqual(profileAAgain.body.profile.student_id, studentA, "Student A must still receive only their own profile");
    console.log("✅ CASE 11 PASSED: Student B cannot modify Student A's profile, photo, or resources.");

    // -------------------------------------------------------------------------
    // CASE 13: Profile-photo stream route is authenticated and tenant-isolated
    // (regression for the review fix: GET /api/storage/profile-photo now sits
    // behind requireStudentAuth and derives identity from the token only)
    // -------------------------------------------------------------------------
    const photoDir = path.join(__dirname, "..", "..", "documents", "storage", "profiles", studentA);
    fs.mkdirSync(photoDir, { recursive: true });
    const photoName = "stage24_avatar_A.png";
    fs.writeFileSync(path.join(photoDir, photoName), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    // No token -> 401 (previously this route streamed anyone's photo)
    const anonPhotoRes = await makeRequest(server, {
      ...base,
      path: `/api/storage/profile-photo?file=${photoName}`,
      method: "GET"
    });
    assert.strictEqual(anonPhotoRes.status, 401, "Profile-photo stream without a token must return 401");

    // Owner streams their own photo with the token alone (no student_id param) -> 200
    const ownerPhotoRes = await makeRequest(server, {
      ...base,
      path: `/api/storage/profile-photo?file=${photoName}`,
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_A" }
    });
    assert.strictEqual(ownerPhotoRes.status, 200, "Owner must be able to stream their own photo with the token alone");
    assert.ok(String(ownerPhotoRes.headers["content-type"] || "").includes("image/png"), "Streamed photo must have an image content type");

    // A different student's token must not stream Student A's photo
    const crossPhotoStreamRes = await makeRequest(server, {
      ...base,
      path: `/api/storage/profile-photo?file=${photoName}`,
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_B" }
    });
    assert.strictEqual(crossPhotoStreamRes.status, 404, "Student B must not stream Student A's photo");

    // Spoofed ?student_id= conflicting with the token -> 403 (middleware tenant check)
    const spoofPhotoRes = await makeRequest(server, {
      ...base,
      path: `/api/storage/profile-photo?file=${photoName}&student_id=${studentB}`,
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_A" }
    });
    assert.strictEqual(spoofPhotoRes.status, 403, "Spoofed student_id conflicting with the token must be rejected with 403");

    // Legacy URL with a MATCHING student_id param keeps working (backward compatibility)
    const legacyPhotoRes = await makeRequest(server, {
      ...base,
      path: `/api/storage/profile-photo?file=${photoName}&student_id=${studentA}`,
      method: "GET",
      headers: { Authorization: "Bearer token_stage24_A" }
    });
    assert.strictEqual(legacyPhotoRes.status, 200, "Legacy URL with matching student_id param must keep working");

    fs.rmSync(path.join(photoDir, photoName), { force: true });
    console.log("✅ CASE 13 PASSED: Profile-photo stream is authenticated and tenant-isolated.");

    // -------------------------------------------------------------------------
    // CASE 12: Production mode — dev tokens disabled, fail-closed 401s
    // -------------------------------------------------------------------------
    const childScript = path.join(__dirname, "test_stage24_production_child.js");
    const childEnv = { ...process.env, NODE_ENV: "production" };
    const child = spawnSync(process.execPath, [childScript], { env: childEnv, encoding: "utf8" });
    assert.strictEqual(child.status, 0, "Production-mode child checks must pass. Output:\n" + child.stdout + child.stderr);
    assert.ok(child.stdout.includes("PROD-CHECK PASSED"), "Child must report production checks passed");
    console.log("✅ CASE 12 PASSED: In production, dev tokens are disabled and all unauthorized requests return 401.");

    console.log("\n==================================================================");
    console.log("🎉 ALL STAGE 24 STRICT AUTH & TENANT ISOLATION TESTS PASSED!");
    console.log("==================================================================\n");
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runStage24Tests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Stage 24 Test Failed:", err);
      process.exit(1);
    });
}

module.exports = { runStage24Tests };
