const fs = require("fs");
const path = require("path");
const { cosineSimilarity } = require("./embeddings");

const DEFAULT_STORE_PATH = path.join(__dirname, "../../database/vector_store.json");

class VectorStore {
  constructor(filePath = DEFAULT_STORE_PATH) {
    this.filePath = filePath;
    this.chunks = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.chunks = JSON.parse(raw);
      } else {
        this.chunks = [];
        this.save();
      }
    } catch (err) {
      console.warn("Could not load vector store from disk, starting empty:", err.message);
      this.chunks = [];
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.chunks, null, 2), "utf-8");
    } catch (err) {
      console.error("Error saving vector store:", err.message);
    }
  }

  /**
   * Adds an array of embedded chunks to the store
   */
  addChunks(newChunks) {
    this.chunks.push(...newChunks);
    this.save();
    return newChunks.length;
  }

  /**
   * Semantic vector search with strict student isolation and optional academic filters
   */
  search(queryVector, options = {}) {
    const {
      student_id,
      subject_id = null,
      course_id = null,
      unit = null,
      topK = 5,
      similarityThreshold = 0.3
    } = options;

    if (!student_id) {
      throw new Error("student_id is strictly required for vector search isolation");
    }

    const scoredChunks = [];

    for (const chunk of this.chunks) {
      // Enforce strict student boundary
      if (chunk.student_id !== student_id) {
        continue;
      }

      // Enforce course filter if supplied
      if (course_id && chunk.course_id !== course_id) {
        continue;
      }

      // Enforce subject filter if supplied
      if (subject_id && chunk.subject_id !== subject_id) {
        continue;
      }

      // Enforce unit filter if supplied
      if (unit && chunk.unit !== unit) {
        continue;
      }

      const score = cosineSimilarity(queryVector, chunk.embedding);

      if (score >= similarityThreshold) {
        scoredChunks.push({
          id: chunk.id,
          resource_id: chunk.resource_id,
          resource_name: chunk.resource_name,
          unit: chunk.unit,
          page_number: chunk.page_number,
          content: chunk.content,
          similarity: parseFloat(score.toFixed(4))
        });
      }
    }

    // Sort descending by similarity score
    scoredChunks.sort((a, b) => b.similarity - a.similarity);

    return scoredChunks.slice(0, topK);
  }

  /**
   * Remove chunks for a specific resource
   */
  removeResource(resource_id) {
    const initialCount = this.chunks.length;
    this.chunks = this.chunks.filter((c) => c.resource_id !== resource_id);
    this.save();
    return initialCount - this.chunks.length;
  }

  /**
   * Clear all records (useful for fresh tests)
   */
  clear() {
    this.chunks = [];
    this.save();
  }

  getCount() {
    return this.chunks.length;
  }

  /**
   * Retrieves all chunks belonging to a specific unit for a student
   */
  getChunksByUnit(student_id, subject_id, unit) {
    if (!student_id) {
      throw new Error("student_id is strictly required for vector store isolation");
    }
    return this.chunks.filter((c) => {
      if (c.student_id !== student_id) return false;
      if (subject_id && c.subject_id !== subject_id) return false;
      if (unit && c.unit && !c.unit.toLowerCase().includes(unit.toLowerCase())) return false;
      return true;
    });
  }

  /**
   * Retrieves all chunks belonging to a student's subject
   */
  getChunksBySubject(student_id, subject_id) {
    if (!student_id) {
      throw new Error("student_id is strictly required for vector store isolation");
    }
    return this.chunks.filter((c) => {
      if (c.student_id !== student_id) return false;
      if (subject_id && c.subject_id !== subject_id) return false;
      return true;
    });
  }
}

module.exports = {
  VectorStore,
  defaultStore: new VectorStore()
};
