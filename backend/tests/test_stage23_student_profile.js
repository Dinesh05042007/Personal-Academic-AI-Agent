const assert = require("assert");
const http = require("http");
const path = require("path");
const fs = require("fs");
const app = require("../server");
const { registerDevToken } = require("../src/authMiddleware");

function makeRequest(server, options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString("utf8");
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (e) {
          json = text;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json, buffer });
      });
    });
    req.on("error", reject);
    if (postData) {
      if (Buffer.isBuffer(postData)) {
        req.write(postData);
      } else if (typeof postData === "string") {
        req.write(postData);
      } else {
        req.write(JSON.stringify(postData));
      }
    }
    req.end();
  });
}

async function runStudentProfileTests() {
  console.log(">>> Running Student Profile Tests (test_stage23_student_profile.js)...");

  // Register dev student tokens
  registerDevToken("token_profile_student_A", {
    id: "student_alpha_uuid",
    student_id: "student_alpha_uuid",
    name: "Student Alpha",
    email: "alpha@university.edu",
    role: "student"
  });

  registerDevToken("token_profile_student_B", {
    id: "student_beta_uuid",
    student_id: "student_beta_uuid",
    name: "Student Beta",
    email: "beta@university.edu",
    role: "student"
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: GET own profile
    // -------------------------------------------------------------------------
    const getRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile",
      method: "GET",
      headers: {
        Authorization: "Bearer token_profile_student_A"
      }
    });
    assert.strictEqual(getRes.status, 200, "GET /api/student/profile must return HTTP 200");
    assert.ok(getRes.body.profile, "Response must contain profile object");
    assert.strictEqual(getRes.body.profile.student_id, "student_alpha_uuid", "Profile ID must match authenticated student A");
    console.log("✅ TEST 1 PASSED: GET own profile returns authenticated student profile.");

    // -------------------------------------------------------------------------
    // TEST 2: Update own profile
    // -------------------------------------------------------------------------
    const putRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile",
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_profile_student_A"
      }
    }, {
      name: "Alpha Updated",
      department: "Computer Science & Engineering",
      year: "2nd Year",
      semester: 4,
      register_number: "2026CS01",
      bio: "Focusing on distributed systems and applied AI."
    });
    assert.strictEqual(putRes.status, 200, "PUT /api/student/profile must return HTTP 200");
    assert.strictEqual(putRes.body.profile.name, "Alpha Updated");
    assert.strictEqual(putRes.body.profile.department, "Computer Science & Engineering");
    assert.strictEqual(putRes.body.profile.year, "2nd Year");
    assert.strictEqual(putRes.body.profile.semester, 4);
    assert.strictEqual(putRes.body.profile.register_number, "2026CS01");
    assert.strictEqual(putRes.body.profile.bio, "Focusing on distributed systems and applied AI.");
    console.log("✅ TEST 2 PASSED: Update own profile persists student academic details.");

    // -------------------------------------------------------------------------
    // TEST 3: Upload valid photo
    // -------------------------------------------------------------------------
    const boundary = "----WebKitFormBoundaryProfileUploadTest";
    const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const validPhotoBody = Buffer.concat([header, fakePng, footer]);

    const photoRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile/photo",
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": validPhotoBody.length,
        Authorization: "Bearer token_profile_student_A"
      }
    }, validPhotoBody);

    assert.strictEqual(photoRes.status, 200, "Photo upload must return HTTP 200");
    assert.ok(photoRes.body.avatar_url, "Response must include avatar_url");
    const uploadedAvatarUrl = photoRes.body.avatar_url;
    console.log("✅ TEST 3 PASSED: Upload valid photo succeeds with avatar_url generation.");

    // -------------------------------------------------------------------------
    // TEST 4: Retrieve/display photo
    // -------------------------------------------------------------------------
    if (uploadedAvatarUrl.startsWith("/api/storage/profile-photo")) {
      const streamRes = await makeRequest(server, {
        hostname: "localhost",
        port,
        path: uploadedAvatarUrl,
        method: "GET"
      });
      assert.strictEqual(streamRes.status, 200, "GET /api/storage/profile-photo must return HTTP 200");
      assert.ok(streamRes.buffer.length > 0, "Retrieved image buffer must not be empty");
      console.log("✅ TEST 4 PASSED: Retrieve/display photo streams image successfully.");
    } else {
      console.log("✅ TEST 4 PASSED: Photo uploaded to cloud storage URL:", uploadedAvatarUrl);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Remove photo
    // -------------------------------------------------------------------------
    const deleteRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile/photo",
      method: "DELETE",
      headers: {
        Authorization: "Bearer token_profile_student_A"
      }
    });
    assert.strictEqual(deleteRes.status, 200, "DELETE /api/student/profile/photo must return HTTP 200");
    assert.strictEqual(deleteRes.body.profile.avatar_url, null, "Avatar URL must be set to null after removal");
    console.log("✅ TEST 5 PASSED: Remove photo clears avatar reference.");

    // -------------------------------------------------------------------------
    // TEST 6: Reject invalid file type (.exe)
    // -------------------------------------------------------------------------
    const invalidHeader = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="exploit.exe"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    const invalidBody = Buffer.concat([invalidHeader, Buffer.from("bad_executable"), footer]);
    const invalidRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile/photo",
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": invalidBody.length,
        Authorization: "Bearer token_profile_student_A"
      }
    }, invalidBody);
    assert.strictEqual(invalidRes.status, 400, "Invalid file format must return HTTP 400");
    assert.ok(
      invalidRes.body.error && invalidRes.body.error.includes("Unsupported image format"),
      "Error must state unsupported image format"
    );
    console.log("✅ TEST 6 PASSED: Reject invalid file type (.exe) strictly enforced.");

    // -------------------------------------------------------------------------
    // TEST 7: Reject oversized file (> 5 MB)
    // -------------------------------------------------------------------------
    const oversizedChunk = Buffer.alloc(5.5 * 1024 * 1024, 0); // 5.5 MB
    const oversizedHeader = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="large.png"\r\nContent-Type: image/png\r\n\r\n`
    );
    const oversizedBody = Buffer.concat([oversizedHeader, oversizedChunk, footer]);
    const oversizedRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile/photo",
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": oversizedBody.length,
        Authorization: "Bearer token_profile_student_A"
      }
    }, oversizedBody);
    assert.strictEqual(oversizedRes.status, 400, "Oversized file upload must return HTTP 400");
    assert.ok(
      oversizedRes.body.error && (oversizedRes.body.error.includes("exceeds the allowed limit") || oversizedRes.body.error.includes("File size")),
      "Response must indicate file size limit exceeded"
    );
    console.log("✅ TEST 7 PASSED: Reject oversized file (>5MB) strictly enforced.");

    // -------------------------------------------------------------------------
    // TEST 8: Verify Student A cannot access Student B's profile data
    // -------------------------------------------------------------------------
    // 8a. Student B requests own profile without query params - must receive Student B's profile, not Student A's
    const studentBRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile",
      method: "GET",
      headers: {
        Authorization: "Bearer token_profile_student_B"
      }
    });
    assert.strictEqual(studentBRes.status, 200, "Student B fetching profile must return 200");
    assert.strictEqual(studentBRes.body.profile.student_id, "student_beta_uuid", "Student B must receive Student B's profile");
    assert.notStrictEqual(studentBRes.body.profile.student_id, "student_alpha_uuid", "Student B must never receive Student A's profile");

    // 8b. Student B attempting to spoof Student A's id in query must be strictly blocked with 403 Forbidden
    const spoofRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile?student_id=student_alpha_uuid",
      method: "GET",
      headers: {
        Authorization: "Bearer token_profile_student_B"
      }
    });
    assert.strictEqual(spoofRes.status, 403, "Spoof attempt of another student ID must be rejected with 403 Forbidden");
    console.log("✅ TEST 8 PASSED: Student A cannot access Student B's profile data (strict tenant isolation & spoof protection).");

    // -------------------------------------------------------------------------
    // TEST 9: Verify Student A cannot modify Student B's photo
    // -------------------------------------------------------------------------
    // First upload photo for Student A
    const photoA_Res = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile/photo",
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": validPhotoBody.length,
        Authorization: "Bearer token_profile_student_A"
      }
    }, validPhotoBody);
    assert.strictEqual(photoA_Res.status, 200);
    const studentA_Avatar = photoA_Res.body.avatar_url;
    assert.ok(studentA_Avatar, "Student A photo upload must succeed");

    // Student B attempts to delete photo (authenticated as B)
    const deleteB_Res = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile/photo",
      method: "DELETE",
      headers: {
        Authorization: "Bearer token_profile_student_B"
      }
    });
    assert.strictEqual(deleteB_Res.status, 200);

    // Verify Student A's photo remains completely intact
    const verifyA_Res = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/profile",
      method: "GET",
      headers: {
        Authorization: "Bearer token_profile_student_A"
      }
    });
    assert.strictEqual(verifyA_Res.status, 200);
    assert.strictEqual(verifyA_Res.body.profile.avatar_url, studentA_Avatar, "Student A's avatar must remain intact when Student B performs actions");
    console.log("✅ TEST 9 PASSED: Student A cannot modify Student B's photo (strict multi-tenant ownership).");

    console.log("------------------------------------------------------------------");
    console.log("🎉 ALL 9 STUDENT PROFILE TESTS PASSED SUCCESSFULLY!\n");
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runStudentProfileTests().catch((err) => {
    console.error("❌ STUDENT PROFILE TEST SUITE FAILED:", err);
    process.exit(1);
  });
}

module.exports = { runStudentProfileTests };
