/**
 * Authentication & Tenant Isolation Middleware
 *
 * SECURITY MODEL
 * --------------
 * PRODUCTION (NODE_ENV=production):
 *   Only real, verified Supabase JWTs are accepted. Dev tokens are DISABLED.
 *   Missing/empty/malformed Bearer credentials => HTTP 401. No fallback identities
 *   are ever derived from query/body/params or arbitrary client-supplied student_id.
 *
 * TEST/DEV (NODE_ENV !== "production"):
 *   Supabase JWTs (when configured) and explicitly registered dev tokens
 *   (registerDevToken / built-in tokens below) are accepted. Unknown or absent
 *   tokens still fail closed with HTTP 401.
 *
 * TENANT ISOLATION
 * ----------------
 * The authenticated identity comes exclusively from the validated JWT or a
 * registered dev token. Client-supplied student_id values in body/query/params
 * are ignored for identity purposes; if they conflict with the authenticated
 * user, the request is rejected with HTTP 403.
 */

// Local simulated session store for test and development only.
// NOTE: production deployments must set NODE_ENV=production (Dockerfile/render.yaml do).
const isProduction = process.env.NODE_ENV === "production";

const devUserTokens = new Map([
  ["token_student_A", { id: "student_A_uuid", student_id: "student_A_uuid", email: "student_a@university.edu", name: "Student Alpha", role: "student" }],
  ["token_student_B", { id: "student_B_uuid", student_id: "student_B_uuid", email: "student_b@university.edu", name: "Student Beta", role: "student" }],
  ["token_dinesh", { id: "dinesh_uuid", student_id: "dinesh_uuid", email: "dinesh@university.edu", name: "Dinesh", role: "student" }],
  ["token_faculty_sharma", { id: "faculty_sharma_uuid", student_id: "faculty_sharma_uuid", email: "dr.sharma@university.edu", name: "Dr. Sharma", role: "faculty" }],
  ["token_admin_dean", { id: "admin_dean_uuid", student_id: "admin_dean_uuid", email: "admin@university.edu", name: "Dean Academic", role: "admin" }]
]);

/**
 * Register a dev token for automated local tests.
 * Ignored in production so test backdoors can never be opened there.
 */
function registerDevToken(token, userObj) {
  if (isProduction) {
    console.warn("[AUTH] registerDevToken ignored: dev tokens are disabled in production.");
    return;
  }
  devUserTokens.set(token, userObj);
}

function send401(res, message) {
  return res.status(401).json({ error: message });
}

function send403(res, message) {
  return res.status(403).json({ error: message });
}

/**
 * Extracts a valid Bearer token from the Authorization header.
 * Returns null for missing, malformed, or empty credentials.
 */
function extractBearerToken(authHeader) {
  if (typeof authHeader !== "string" || authHeader.length === 0) return null;
  const parts = authHeader.split(" ");
  // Exactly "Bearer <token>"; no extra segments, no empty token.
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  const token = parts[1];
  return token.length > 0 ? token : null;
}

async function requireStudentAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // Fail closed: every protected route requires a syntactically valid Bearer token.
  // Never derive an identity from query/body/params or client-supplied student_id.
  const token = extractBearerToken(authHeader);
  if (!token) {
    return send401(res, "Authentication required: Missing, malformed, or empty Bearer token");
  }

  // 1. Dev/test tokens (disabled in production)
  if (!isProduction && devUserTokens.has(token)) {
    // Clone: req.user must never reference (and mutate) the shared stored object.
    req.user = { ...devUserTokens.get(token) };
  } else {
    // 2. Real authentication: Supabase JWT verification (2026 secret key, legacy anon key)
    const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;
    if (process.env.SUPABASE_URL && supabaseKey) {
      try {
        let hostName = "unknown";
        try { hostName = new URL(process.env.SUPABASE_URL).hostname; } catch (e) {}
        console.log(`[AUTH] Verifying token (len=${token.length}) against Supabase host="${hostName}", key_configured=${process.env.SUPABASE_SECRET_KEY ? "SUPABASE_SECRET_KEY" : "SUPABASE_ANON_KEY"}`);

        const { createClient } = require("@supabase/supabase-js");
        const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
          console.error(`[AUTH ERROR] Supabase auth.getUser failed: status=${error?.status || 401}, code=${error?.code || "none"}, message="${error?.message || "User object null"}"`);
          return send401(res, "Invalid or expired session token");
        }
        req.user = {
          id: user.id,
          student_id: user.id,
          email: user.email,
          role: user.user_metadata?.role || "student"
        };
      } catch (err) {
        console.error(`[AUTH ERROR] Exception during auth verification: ${err.message}`);
        return send401(res, "Invalid or expired session token");
      }
    } else {
      // No Supabase and not a registered dev token => the token cannot be validated.
      return send401(res, "Invalid or expired session token");
    }
  }

  // Ensure role is assigned on the per-request identity object
  if (!req.user.role) {
    req.user.role = "student";
  }

  // CRITICAL TENANT ISOLATION CHECK:
  // The client may echo its own student_id, but it must never CONFLICT with the
  // authenticated identity. Any conflicting student_id in body/query/params => 403.
  const clientProvidedId =
    (req.body && req.body.student_id) ||
    (req.query && req.query.student_id) ||
    (req.params && req.params.student_id);
  if (clientProvidedId && clientProvidedId !== req.user.student_id) {
    return send403(res, "Access Denied: Client attempted to access or spoof another student's account!");
  }

  // Force authenticated student_id into request body and query to guarantee isolation
  if (req.body) {
    req.body.student_id = req.user.student_id;
  }

  next();
}

/**
 * Role-Based Access Control Middleware
 * Enforces role restrictions (student, faculty, admin) on protected endpoints.
 */
function requireRole(allowedRoles = []) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return send403(res, "Access Denied: User role not determined or insufficient permissions");
    }

    if (!roles.includes(req.user.role)) {
      return send403(res, `Access Denied: Role '${req.user.role}' is not authorized to access this resource. Required: ${roles.join(", ")}`);
    }

    next();
  };
}

/**
 * Validates that a file/resource path belongs strictly to the authenticated student.
 *
 * Exact ownership matching: the first path segment must be EXACTLY the student's id
 * (never a superstring like "student_A_uuid_evil"), while legitimate nested paths
 * like "<studentId>/<subjectId>/<file>" remain fully supported.
 *
 * Returns false for empty ids/paths, traversal attempts ("..", absolute paths),
 * and backslash-aliasing, all of which must never bypass the tenant boundary.
 */
function verifyStudentResourceOwnership(studentId, resourcePath) {
  if (!studentId || typeof resourcePath !== "string" || resourcePath.length === 0) return false;
  if (resourcePath.includes("\\") || resourcePath.includes("..") || resourcePath.startsWith("/")) return false;

  const normalized = resourcePath.replace(/\\/g, "/");
  const firstSegment = normalized.split("/")[0];
  return firstSegment === studentId;
}

module.exports = {
  requireStudentAuth,
  requireRole,
  registerDevToken,
  devUserTokens,
  verifyStudentResourceOwnership
};
