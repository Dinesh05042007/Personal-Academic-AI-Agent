const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const STORE_PATH = path.join(__dirname, "../../database/academic_metadata.json");

class AcademicStore {
  constructor(filePath = STORE_PATH) {
    this.filePath = filePath;
    this.courses = [];
    this.subjects = [];
    this.resources = [];
    this.profiles = {};
    this.load();
    this.seedDefaultsIfEmpty();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
        this.courses = data.courses || [];
        this.subjects = data.subjects || [];
        this.resources = data.resources || [];
        this.profiles = data.profiles || {};
      }
    } catch (err) {
      console.warn("Could not load academic metadata:", err.message);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(
          {
            courses: this.courses,
            subjects: this.subjects,
            resources: this.resources,
            profiles: this.profiles
          },
          null,
          2
        )
      );
    } catch (err) {
      console.error("Error saving academic store:", err.message);
    }
  }

  seedDefaultsIfEmpty() {
    if (this.courses.length === 0) {
      const defaultCourseId = "course_btech_cse";
      this.courses.push({
        id: defaultCourseId,
        student_id: "student_001",
        name: "B.Tech Computer Science & Engineering",
        semester: 3,
        created_at: new Date().toISOString()
      });

      const osSubjectId = "subj_os";
      this.subjects.push(
        {
          id: osSubjectId,
          course_id: defaultCourseId,
          student_id: "student_001",
          name: "Operating Systems",
          code: "CS301",
          created_at: new Date().toISOString()
        },
        {
          id: "subj_dbms",
          course_id: defaultCourseId,
          student_id: "student_001",
          name: "Database Management Systems",
          code: "CS302",
          created_at: new Date().toISOString()
        },
        {
          id: "subj_csharp",
          course_id: defaultCourseId,
          student_id: "student_001",
          name: "C# Programming",
          code: "CS303",
          created_at: new Date().toISOString()
        },
        {
          id: "subj_cn",
          course_id: defaultCourseId,
          student_id: "student_001",
          name: "Computer Networks",
          code: "CS304",
          created_at: new Date().toISOString()
        }
      );

      this.resources.push({
        id: uuidv4(),
        student_id: "student_001",
        course_id: defaultCourseId,
        subject_id: osSubjectId,
        name: "Operating Systems Unit 1.pdf",
        unit: "Unit 1",
        file_type: "pdf",
        file_path: "documents/Operating_Systems_Unit_1.pdf",
        created_at: new Date().toISOString()
      });

      this.save();
    }
  }

  // Tenant-filtered Course operations
  getCourses(studentId) {
    return this.courses.filter((c) => c.student_id === studentId);
  }

  addCourse(studentId, name, semester) {
    const course = {
      id: "course_" + uuidv4().slice(0, 8),
      student_id: studentId,
      name,
      semester: parseInt(semester, 10) || 1,
      created_at: new Date().toISOString()
    };
    this.courses.push(course);
    this.save();
    return course;
  }

  // Tenant-filtered Subject operations
  getSubjects(studentId, courseId = null) {
    return this.subjects.filter(
      (s) => s.student_id === studentId && (!courseId || s.course_id === courseId)
    );
  }

  addSubject(studentId, courseId, name, code) {
    const subject = {
      id: "subj_" + uuidv4().slice(0, 8),
      course_id: courseId,
      student_id: studentId,
      name,
      code: code || "",
      created_at: new Date().toISOString()
    };
    this.subjects.push(subject);
    this.save();
    return subject;
  }

  // Tenant-filtered Resource operations
  getResources(studentId, subjectId = null) {
    return this.resources.filter(
      (r) => r.student_id === studentId && (!subjectId || r.subject_id === subjectId)
    );
  }

  addResource(studentId, metadata) {
    const res = {
      id: uuidv4(),
      student_id: studentId,
      course_id: metadata.course_id,
      subject_id: metadata.subject_id,
      name: metadata.name,
      unit: metadata.unit || "Unit 1",
      file_type: metadata.file_type || "pdf",
      file_path: metadata.file_path,
      processing_status: metadata.processing_status || "completed",
      created_at: new Date().toISOString()
    };
    this.resources.push(res);
    this.save();
    return res;
  }

  getResourceById(resourceId) {
    return this.resources.find((r) => r.id === resourceId);
  }

  updateResourceStatus(resourceId, status, error = null) {
    const res = this.resources.find((r) => r.id === resourceId);
    if (res) {
      res.processing_status = status;
      if (error !== null) {
        res.processing_error = error;
      }
      this.save();
      return res;
    }
    return null;
  }

  // --- Stage 19: Faculty & Institutional Management ---
  getAllCourses() {
    return [...this.courses];
  }

  createOfficialCourse(name, semester, code = null, facultyId = "faculty_sharma_uuid") {
    const course = {
      id: "course_off_" + uuidv4().slice(0, 8),
      code: code || "CSE" + (semester * 100 + 1),
      name,
      semester: parseInt(semester, 10) || 1,
      faculty_id: facultyId,
      created_at: new Date().toISOString()
    };
    this.courses.push(course);
    this.save();
    return course;
  }

  getAllSubjects(courseId = null) {
    if (courseId) {
      return this.subjects.filter((s) => s.course_id === courseId);
    }
    return [...this.subjects];
  }

  getPlatformStats() {
    const studentIds = new Set([
      ...this.courses.map((c) => c.student_id),
      ...this.resources.map((r) => r.student_id)
    ].filter(Boolean));

    let vectorCount = 0;
    try {
      const { defaultStore } = require("./vectorStore");
      vectorCount = defaultStore ? defaultStore.getCount() : 0;
    } catch (e) {
      // Ignore
    }

    return {
      courses_count: this.courses.length,
      students_count: Math.max(studentIds.size, 1),
      resources_count: this.resources.length,
      ai_chats_count: 2430,
      vector_chunks_count: vectorCount
    };
  }

  getAllUsers() {
    try {
      const { devUserTokens } = require("./authMiddleware");
      const users = [];
      for (const [, u] of devUserTokens.entries()) {
        users.push({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role || "student",
          status: "active"
        });
      }
      return users;
    } catch (e) {
      return [
        { id: "student_A_uuid", name: "Student Alpha", email: "student_a@university.edu", role: "student", status: "active" },
        { id: "faculty_sharma_uuid", name: "Dr. Sharma", email: "dr.sharma@university.edu", role: "faculty", status: "active" },
        { id: "admin_dean_uuid", name: "Dean Academic", email: "admin@university.edu", role: "admin", status: "active" }
      ];
    }
  }

  getProfile(studentId, defaultUser = null) {
    if (!this.profiles) this.profiles = {};
    if (!this.profiles[studentId]) {
      const defaultName = defaultUser?.name || defaultUser?.user_metadata?.full_name || "Student";
      const defaultEmail = defaultUser?.email || "";
      this.profiles[studentId] = {
        id: studentId,
        student_id: studentId,
        name: defaultName,
        email: defaultEmail,
        role: defaultUser?.role || defaultUser?.user_metadata?.role || "student",
        department: "",
        year: "",
        semester: null,
        register_number: "",
        bio: "",
        avatar_url: null,
        created_at: new Date().toISOString()
      };
      this.save();
    }
    return this.profiles[studentId];
  }

  updateProfile(studentId, updates = {}) {
    const profile = this.getProfile(studentId);
    const allowed = ["name", "bio", "department", "year", "semester", "register_number", "avatar_url"];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        profile[key] = updates[key];
      }
    }
    this.profiles[studentId] = profile;
    this.save();
    return profile;
  }
}

module.exports = {
  AcademicStore,
  defaultAcademicStore: new AcademicStore()
};
