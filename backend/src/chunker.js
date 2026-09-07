const { v4: uuidv4 } = require("uuid");

/**
 * Splits text into chunks with overlap, respecting sentence/paragraph boundaries
 */
function splitTextIntoChunks(text, chunkSize = 450, chunkOverlap = 90) {
  if (!text || text.trim().length === 0) return [];
  if (text.length <= chunkSize) return [text.trim()];

  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex < text.length) {
      // Find clean breaking point (newline, period, or space)
      const newlineBreak = text.lastIndexOf("\n", endIndex);
      const sentenceBreak = text.lastIndexOf(". ", endIndex);
      const spaceBreak = text.lastIndexOf(" ", endIndex);

      if (newlineBreak > startIndex + (chunkSize / 2)) {
        endIndex = newlineBreak;
      } else if (sentenceBreak > startIndex + (chunkSize / 2)) {
        endIndex = sentenceBreak + 1;
      } else if (spaceBreak > startIndex + (chunkSize / 2)) {
        endIndex = spaceBreak;
      }
    } else {
      endIndex = text.length;
    }

    const chunkContent = text.slice(startIndex, endIndex).trim();
    if (chunkContent.length > 0) {
      chunks.push(chunkContent);
    }

    if (endIndex >= text.length) break;

    // Advance with overlap
    startIndex = Math.max(endIndex - chunkOverlap, startIndex + 1);
  }

  return chunks;
}

/**
 * Takes extracted document pages and creates structured metadata-tagged chunks
 */
function chunkDocumentPages(pages, metadata = {}) {
  const resultChunks = [];
  let overallChunkIndex = 0;

  for (const page of pages) {
    const pageChunks = splitTextIntoChunks(page.text, metadata.chunkSize || 450, metadata.chunkOverlap || 90);

    for (const chunkText of pageChunks) {
      resultChunks.push({
        id: uuidv4(),
        chunk_index: overallChunkIndex++,
        student_id: metadata.student_id || "default_student",
        course_id: metadata.course_id || "general_course",
        subject_id: metadata.subject_id || "general_subject",
        resource_id: metadata.resource_id || uuidv4(),
        resource_name: metadata.resource_name || "Unknown Resource",
        unit: metadata.unit || "Unit 1",
        page_number: page.pageNumber || 1,
        content: chunkText,
        created_at: new Date().toISOString()
      });
    }
  }

  return resultChunks;
}

module.exports = {
  splitTextIntoChunks,
  chunkDocumentPages
};
