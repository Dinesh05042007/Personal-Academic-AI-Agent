const { pipeline } = require("@xenova/transformers");

let localExtractor = null;
let warmupStarted = false;
let warmupDone = false;

/**
 * Initializes and caches the local HuggingFace sentence transformer pipeline.
 * On Render/cloud, the first call downloads the ONNX model weights (~22MB).
 * Call warmUpEmbeddingModel() at server boot so this cost is paid once upfront,
 * not on the first student upload request.
 */
async function getLocalExtractor() {
  if (!localExtractor) {
    const t0 = Date.now();
    console.log("[EMBEDDINGS] Initializing Xenova/all-MiniLM-L6-v2 ONNX model...");
    localExtractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    warmupDone = true;
    console.log(`[EMBEDDINGS] Model ready in ${Date.now() - t0}ms`);
  }
  return localExtractor;
}

/**
 * Pre-warms the embedding model at server startup.
 * Call once from server.js during initialization — do not await, let it warm in background.
 */
async function warmUpEmbeddingModel() {
  if (warmupStarted) return;
  warmupStarted = true;
  try {
    const t0 = Date.now();
    console.log("[EMBEDDINGS] Background warm-up: loading ONNX model...");
    await getLocalExtractor();
    // Run one throwaway embedding to JIT-compile ONNX ops
    await generateEmbedding("warm up embedding initialization");
    console.log(`[EMBEDDINGS] Warm-up complete in ${Date.now() - t0}ms — model is ready`);
  } catch (err) {
    console.error("[EMBEDDINGS] Warm-up failed:", err.message);
  }
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
 * Generates embeddings for a batch of chunks with per-chunk timing logs
 */
async function generateBatchEmbeddings(chunks, onProgress = null) {
  const extractor = await getLocalExtractor();
  const embeddedChunks = [];
  const batchStart = Date.now();

  console.log(`[EMBEDDINGS] Generating embeddings for ${chunks.length} chunks...`);

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

    // Log progress every 10 chunks to track slow embeddings on cloud
    if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
      const elapsed = Date.now() - batchStart;
      const rate = ((i + 1) / (elapsed / 1000)).toFixed(1);
      console.log(`[EMBEDDINGS] Progress: ${i + 1}/${chunks.length} chunks (${rate} chunks/sec, ${elapsed}ms elapsed)`);
    }
  }

  console.log(`[EMBEDDINGS] Batch complete: ${embeddedChunks.length} embeddings in ${Date.now() - batchStart}ms`);
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
  cosineSimilarity,
  warmUpEmbeddingModel,
  isModelReady: () => warmupDone
};
