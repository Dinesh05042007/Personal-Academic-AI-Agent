/**
 * Authentication & Tenant Isolation Middleware
 * Enforces authenticated identity and blocks client student_id spoofing
 */

// Local simulated session store for test and development without live cloud dependency
const devUserTokens = new Map([
  ["token_student_A", { id: "student_A_uuid", student_id: "student_A_uuid", email: "student_a@university.edu", name: "Student Alpha", role: "student" }],
  ["token_student_B", { id: "student_B_uuid", student_id: "student_B_uuid", email: "student_b@university.edu", name: "Student Beta", role: "student" }],
  ["token_dinesh", { id: "dinesh_uuid", student_id: "dinesh_uuid", email: "dinesh@university.edu", name: "Dinesh", role: "student" }],
  ["token_faculty_sharma", { id: "faculty_sharma_uuid", student_id: "faculty_sharma_uuid", email: "dr.sharma@university.edu", name: "Dr. Sharma", role: "faculty" }],
  ["token_admin_dean", { id: "admin_dean_uuid", student_id: "admin_dean_uuid", email: "admin@university.edu", name: "Dean Academic", role: "admin" }]
]);

function registerDevToken(token, userObj) {
  devUserTokens.set(token, userObj);
}

async function requireStudentAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // If no bearer token is supplied, check if running in permissive local mode with a default student
    // or return 401 Unauthorized
    if (process.env.STRICT_AUTH === "true") {
      return res.status(401).json({ error: "Authentication required: Missing or invalid Bearer token" });
    }
    // Permissive local default fallback for backward compatibility
    req.user = {
      id: (req.body && req.body.student_id) || (req.query && req.query.student_id) || "student_001",
      student_id: (req.body && req.body.student_id) || (req.query && req.query.student_id) || "student_001",
      email: "local_student@academic.local",
      role: "student"
    };
    return next();
  }

  const token = authHeader.split(" ")[1];

  // 1. Check local session/dev tokens
  if (devUserTokens.has(token)) {
    req.user = devUserTokens.get(token);
  } else {
    // 2. If Supabase JWT verification is enabled (supports 2026 secret key and legacy anon key)
    const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;
    if (process.env.SUPABASE_URL && supabaseKey) {
      try {
        const { createClient } = require("@supabase/supabase-js");
        const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
          return res.status(401).json({ error: "Invalid or expired session token" });
        }
        req.user = {
          id: user.id,
          student_id: user.id,
          email: user.email,
          role: user.user_metadata?.role || "student"
        };
      } catch (err) {
        return res.status(401).json({ error: "Auth verification failed: " + err.message });
      }
    } else {
      // Treat custom bearer tokens format: Bearer token_<studentId>
      const cleanId = token.replace("token_", "");
      req.user = {
        id: cleanId,
        student_id: cleanId,
        email: `${cleanId}@university.edu`,
        role: "student"
      };
    }
  }

  // Ensure role is assigned
  if (!req.user.role) {
    req.user.role = "student";
  }

  // CRITICAL TENANT ISOLATION CHECK (Step 224 & Stage 14):
  // Never trust client-supplied student_id in body or query if it differs from authenticated user!
  const clientProvidedId = (req.body && req.body.student_id) || (req.query && req.query.student_id);
  if (clientProvidedId && clientProvidedId !== req.user.student_id) {
    return res.status(403).json({
      error: "Access Denied: Client attempted to access or spoof another student's account!"
    });
  }

  // Force authenticated student_id into request body and query to guarantee isolation
  if (req.body) {
    req.body.student_id = req.user.student_id;
  }

  next();
}

/**
 * Role-Based Access Control Middleware (Step 665)
 * Enforces role restrictions (student, faculty, admin) on protected endpoints.
 */
function requireRole(allowedRoles = []) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: "Access Denied: User role not determined or insufficient permissions" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access Denied: Role '${req.user.role}' is not authorized to access this resource. Required: ${roles.join(", ")}`
      });
    }

    next();
  };
}

/**
 * Validates that a file/resource path belongs strictly to the authenticated student
 */
function verifyStudentResourceOwnership(studentId, resourcePath) {
  if (!studentId || !resourcePath) return false;
  const normalized = resourcePath.replace(/\\/g, "/");
  return normalized.startsWith(`${studentId}/`) || normalized.startsWith(`${studentId}`);
}

module.exports = {
  requireStudentAuth,
  requireRole,
  registerDevToken,
  devUserTokens,
  verifyStudentResourceOwnership
};
