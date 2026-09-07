const { pipeline } = require("@xenova/transformers");

let localExtractor = null;

/**
 * Initializes and caches the local HuggingFace sentence transformer pipeline
 */
async function getLocalExtractor() {
  if (!localExtractor) {
    localExtractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return localExtractor;
}

/**
 * Generates normalized 384-dimensional dense vector embeddings for a given text
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Text is required for embedding generation");
  }

  const extractor = await getLocalExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Generates embeddings for a batch of chunks
 */
async function generateBatchEmbeddings(chunks, onProgress = null) {
  const extractor = await getLocalExtractor();
  const embeddedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const output = await extractor(chunk.content, { pooling: "mean", normalize: true });
    embeddedChunks.push({
      ...chunk,
      embedding: Array.from(output.data)
    });

    if (onProgress) {
      onProgress(i + 1, chunks.length);
    }
  }

  return embeddedChunks;
}

/**
 * Computes cosine similarity between two normalized vectors (dot product)
 */
function cosineSimilarity(vectorA, vectorB) {
  if (!vectorA || !vectorB || vectorA.length !== vectorB.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
  }
  return dotProduct;
}

module.exports = {
  generateEmbedding,
  generateBatchEmbeddings,
  cosineSimilarity
};
