const path = require("path");
const fs = require("fs");

const STORAGE_ROOT = path.join(__dirname, "../../documents/storage");

class StorageService {
  constructor(rootDir = STORAGE_ROOT) {
    this.rootDir = rootDir;
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
  }

  /**
   * Generates tenant-isolated destination path: {student_id}/{subject_id}/{timestamp}-{filename}
   */
  getDestinationPath(studentId, subjectId, filename) {
    const studentDir = path.join(this.rootDir, studentId, subjectId);
    if (!fs.existsSync(studentDir)) {
      fs.mkdirSync(studentDir, { recursive: true });
    }
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const uniqueName = `${Date.now()}-${cleanFilename}`;
    const relativePath = `${studentId}/${subjectId}/${uniqueName}`;
    const absolutePath = path.join(this.rootDir, relativePath);
    return { relativePath, absolutePath };
  }

  /**
   * Save uploaded buffer or file into private storage
   */
  saveFile(studentId, subjectId, filename, dataBuffer) {
    const { relativePath, absolutePath } = this.getDestinationPath(studentId, subjectId, filename);
    fs.writeFileSync(absolutePath, dataBuffer);
    return { relativePath, absolutePath };
  }

  /**
   * Resolves a relative storage path safely, preventing directory traversal
   */
  resolvePath(relativePath) {
    const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, "");
    const absolutePath = path.join(this.rootDir, safePath);
    if (!absolutePath.startsWith(this.rootDir)) {
      throw new Error("Invalid file path traversal attempt");
    }
    return absolutePath;
  }

  /**
   * Simulates temporary signed URL creation for private files (Step 383)
   */
  createSignedUrl(relativePath, expiresInSeconds = 3600) {
    const safePath = this.resolvePath(relativePath);
    if (!fs.existsSync(safePath)) {
      throw new Error("File not found in storage");
    }
    // Tokenized streaming path
    const expiry = Date.now() + expiresInSeconds * 1000;
    return `http://localhost:3000/api/storage/file?path=${encodeURIComponent(relativePath)}&expires=${expiry}`;
  }
}

module.exports = {
  StorageService,
  defaultStorageService: new StorageService()
};
