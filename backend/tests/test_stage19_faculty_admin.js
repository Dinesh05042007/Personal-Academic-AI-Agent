const axios = require("axios");
const path = require("path");
const fs = require("fs");
const app = require("../server");
const { defaultRAGService } = require("../src/ragService");

async function runStage19Tests() {
  console.log("==================================================================");
  console.log("👨‍🏫 RUNNING STAGE 19: FACULTY & ADMIN DASHBOARD VERIFICATION");
  console.log("==================================================================\n");

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  console.log(`Server listening on port: ${port}\n`);

  const studentClient = axios.create({
    baseURL: `http://localhost:${port}`,
    headers: {
      Authorization: "Bearer token_student_A",
      "Content-Type": "application/json"
    }
  });

  const facultyClient = axios.create({
    baseURL: `http://localhost:${port}`,
    headers: {
      Authorization: "Bearer token_faculty_sharma",
      "Content-Type": "application/json"
    }
  });

  const adminClient = axios.create({
    baseURL: `http://localhost:${port}`,
    headers: {
      Authorization: "Bearer token_admin_dean",
      "Content-Type": "application/json"
    }
  });

  try {
    // Ingest sample document for student A to test private resource isolation
    const testPdfPath = path.join(__dirname, "../../documents/Operating_Systems_Unit_1.pdf");
    await defaultRAGService.ingestDocument(testPdfPath, {
      student_id: "student_A_uuid",
      course_id: "course_btech_cse",
      subject_id: "subj_os",
      unit: "Unit 1",
      resource_name: "Operating Systems Unit 1.pdf",
      mimeType: "application/pdf"
    });

    // --- TEST 1: User Role Discovery (/api/auth/me) ---
    console.log("--- TEST 1: User Role Discovery via /api/auth/me ---");
    const studentMe = await studentClient.get("/api/auth/me");
    const facultyMe = await facultyClient.get("/api/auth/me");
    const adminMe = await adminClient.get("/api/auth/me");

    if (
      studentMe.data.user?.role === "student" &&
      facultyMe.data.user?.role === "faculty" &&
      adminMe.data.user?.role === "admin"
    ) {
      console.log(`   Student role: ${studentMe.data.user.role}`);
      console.log(`   Faculty role: ${facultyMe.data.user.role}`);
      console.log(`   Admin role: ${adminMe.data.user.role}`);
      console.log("✅ TEST 1 PASSED: User roles successfully identified and returned.\n");
    } else {
      throw new Error("TEST 1 FAILED: Unexpected user roles returned");
    }

    // --- TEST 2: Registration Self-Grant Prevention ---
    console.log("--- TEST 2: Role Self-Selection Prevention ---");
    // Any unauthenticated/default session defaults strictly to student role
    const unauthedRes = await axios.get(`http://localhost:${port}/api/auth/me`);
    if (unauthedRes.data.user?.role === "student") {
      console.log("   Unauthenticated fallback role:", unauthedRes.data.user.role);
      console.log("✅ TEST 2 PASSED: Default role is strictly 'student'; client cannot self-grant admin.\n");
    } else {
      throw new Error("TEST 2 FAILED: Non-student default role detected");
    }

    // --- TEST 3: Role Middleware (Student Blocked from /api/admin/stats) ---
    console.log("--- TEST 3: Student Access Blocked on Elevated Endpoints ---");
    try {
      await studentClient.get("/api/admin/stats");
      throw new Error("Student was able to access /api/admin/stats!");
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log(`   Expected 403 received: "${err.response.data.error}"`);
        console.log("✅ TEST 3 PASSED: Student blocked from /api/admin/stats with HTTP 403.\n");
      } else {
        throw new Error(`TEST 3 FAILED: Expected HTTP 403, got ${err.response?.status || err.message}`);
      }
    }

    // --- TEST 4: Faculty Token Authorized on /api/admin/stats ---
    console.log("--- TEST 4: Faculty Authorization on Stats Endpoint ---");
    const statsRes = await facultyClient.get("/api/admin/stats");
    if (statsRes.data?.success && statsRes.data?.user_role === "faculty" && statsRes.data?.stats) {
      console.log("   Faculty accessed stats:", statsRes.data.stats);
      console.log("✅ TEST 4 PASSED: Faculty successfully authorized to view aggregated stats.\n");
    } else {
      throw new Error("TEST 4 FAILED: Faculty authorization failed");
    }

    // --- TEST 5: Faculty Course Creation (POST /api/admin/courses) ---
    console.log("--- TEST 5: Official Course Creation by Faculty ---");
    const newCourseRes = await facultyClient.post("/api/admin/courses", {
      name: "Cloud Computing & Distributed Systems",
      semester: 4,
      code: "CS401"
    });

    if (newCourseRes.data?.course && newCourseRes.data.course.name.includes("Cloud Computing")) {
      console.log("   Created course:", newCourseRes.data.course.name, `(${newCourseRes.data.course.code})`);
      console.log("✅ TEST 5 PASSED: Faculty successfully created official academic course.\n");
    } else {
      throw new Error("TEST 5 FAILED: Course creation failed");
    }

    // --- TEST 6: Admin User Audit & Role Enforcement on /api/admin/users ---
    console.log("--- TEST 6: Admin User Audit & Privilege Isolation ---");
    // Faculty should be blocked from user management
    try {
      await facultyClient.get("/api/admin/users");
      throw new Error("Faculty was able to access /api/admin/users!");
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log("   Faculty blocked from /api/admin/users with HTTP 403 as expected.");
      } else {
        throw new Error(`Expected HTTP 403 for faculty, got ${err.response?.status}`);
      }
    }

    // Admin should be authorized
    const usersRes = await adminClient.get("/api/admin/users");
    if (usersRes.data?.success && usersRes.data?.users?.length >= 3) {
      console.log(`   Admin audited ${usersRes.data.users.length} registered users:`, usersRes.data.users.map((u) => `${u.name} (${u.role})`).join(", "));
      console.log("✅ TEST 6 PASSED: User audit endpoint exclusively accessible by admin.\n");
    } else {
      throw new Error("TEST 6 FAILED: Admin unable to audit users");
    }

    // --- TEST 7: Private Student Resource Isolation from Faculty ---
    console.log("--- TEST 7: Student Private File Protection from Faculty (Step 647 & 663) ---");
    // Faculty attempts to download Student A's private PDF
    try {
      await facultyClient.get("/api/storage/file?path=student_A_uuid/subj_os/Operating_Systems_Unit_1.pdf");
      throw new Error("Faculty was able to download Student A's private personal resource file!");
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log(`   Download denied with HTTP 403: "${err.response.data.error}"`);
        console.log("✅ TEST 7 PASSED: Faculty cannot access students' private personal files.\n");
      } else {
        throw new Error(`Expected HTTP 403 for private file, got ${err.response?.status || err.message}`);
      }
    }

    // --- TEST 8: Aggregated Metrics Do Not Leak Student Query Text ---
    console.log("--- TEST 8: Aggregated Statistics Anonymity Verification ---");
    const adminStatsRes = await adminClient.get("/api/admin/stats");
    const st = adminStatsRes.data.stats;
    const statsJson = JSON.stringify(st);

    if (
      st.courses_count > 0 &&
      st.resources_count > 0 &&
      !statsJson.includes("dual-mode") &&
      !statsJson.includes("deadlock")
    ) {
      console.log("   Aggregated totals:", st);
      console.log("✅ TEST 8 PASSED: Statistics report platform metrics without leaking student questions.\n");
    } else {
      throw new Error("TEST 8 FAILED: Statistics invalid or leaking student query details");
    }

    // --- TEST 9: Database Migration Script Validation ---
    console.log("--- TEST 9: Database Migration Script Structure ---");
    const sqlPath = path.join(__dirname, "../../database/stage19_faculty_admin_roles.sql");
    if (fs.existsSync(sqlPath)) {
      const sqlContent = fs.readFileSync(sqlPath, "utf-8");
      if (
        sqlContent.includes("profiles") &&
        sqlContent.includes("role TEXT") &&
        sqlContent.includes("academic_courses") &&
        sqlContent.includes("ROW LEVEL SECURITY")
      ) {
        console.log("   Migration script verified at:", sqlPath);
        console.log("✅ TEST 9 PASSED: SQL schema and RLS policies correctly defined.\n");
      } else {
        throw new Error("TEST 9 FAILED: Migration script missing required RLS or role statements");
      }
    } else {
      throw new Error("TEST 9 FAILED: Migration file not found");
    }

    console.log("==================================================================");
    console.log("🎉 ALL 9 STAGE 19 FACULTY & ADMIN DASHBOARD TESTS PASSED!");
    console.log("==================================================================\n");
  } catch (err) {
    console.error("❌ STAGE 19 TESTS FAILED:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
    process.exit(1);
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runStage19Tests();
}

module.exports = runStage19Tests;
