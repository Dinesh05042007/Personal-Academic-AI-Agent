/**
 * Stage 24 CASE 12 helper: runs with NODE_ENV=production to verify that
 * production auth is strict — dev tokens disabled, everything unauthorized 401.
 * Prints "PROD-CHECK PASSED" only if all assertions hold.
 */
const assert = require("assert");
const http = require("http");
const app = require("../server");
const { devUserTokens } = require("../src/authMiddleware");

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

async function runProdChecks() {
  // Sanity: production module state — dev tokens disabled for lookups
  assert.ok(process.env.NODE_ENV === "production", "Child must run under NODE_ENV=production");
  console.log(`[prod-child] NODE_ENV=${process.env.NODE_ENV}, dev tokens registered: ${devUserTokens.size}`);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 1. A registered dev token must NOT authenticate in production
    const devRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/courses",
      method: "GET",
      headers: { Authorization: "Bearer token_student_A" }
    });
    assert.strictEqual(devRes.status, 401, "Dev token must be rejected with 401 in production");

    // 2. registerDevToken must be a no-op in production
    const { registerDevToken } = require("../src/authMiddleware");
    registerDevToken("token_evil_prod", { id: "evil", student_id: "evil", email: "evil@evil.edu" });
    const evilRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/courses",
      method: "GET",
      headers: { Authorization: "Bearer token_evil_prod" }
    });
    assert.strictEqual(evilRes.status, 401, "registerDevToken must be a no-op in production");

    // 3. Missing header -> 401
    const missingRes = await makeRequest(server, { hostname: "localhost", port, path: "/api/student/courses", method: "GET" });
    assert.strictEqual(missingRes.status, 401, "Missing Authorization must return 401 in production");

    // 4. Empty Bearer -> 401
    const emptyRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/courses",
      method: "GET",
      headers: { Authorization: "Bearer " }
    });
    assert.strictEqual(emptyRes.status, 401, "Empty Bearer must return 401 in production");

    // 5. Malformed header -> 401
    const malformedRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/courses",
      method: "GET",
      headers: { Authorization: "Bearer" }
    });
    assert.strictEqual(malformedRes.status, 401, "Malformed Bearer must return 401 in production");

    // 6. Invalid JWT-shaped token -> 401
    const invalidRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/student/courses",
      method: "GET",
      headers: { Authorization: "Bearer eyJhbGciOiJub25lIn0.invalid.signature" }
    });
    assert.strictEqual(invalidRes.status, 401, "Invalid JWT must return 401 in production");

    console.log("PROD-CHECK PASSED: production auth is strict (all unauthorized requests returned 401).");
  } finally {
    server.close();
  }
}

runProdChecks()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("PROD-CHECK FAILED:", err.message);
    process.exit(1);
  });
