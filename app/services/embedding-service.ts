import "server-only";
import type { Chunk } from "./chunking-service";

// ── Types ────────────────────────────────────────────────────────────────────

/** A chunk enriched with its embedding vector */
export interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

// ── Text cleaning ────────────────────────────────────────────────────────────

/** Strip PDF artifacts and normalise whitespace so embeddings are cleaner. */
function cleanText(text: string): string {
  return text
    .replaceAll("\r\n", "\n")               // normalise line endings
    .replaceAll(/\n{3,}/g, "\n\n")       // collapse excessive blank lines
    .replaceAll(/[ \t]{2,}/g, " ")       // collapse repeated spaces/tabs
    .replaceAll(/[^\S\n]+\n/g, "\n")     // trim trailing spaces per line
    .trim();
}

// ── Pipeline (lazy-loaded singleton) ─────────────────────────────────────────

// BGE-small-en-v1.5 — 384-d vectors, significantly more accurate than
// all-MiniLM-L6-v2 for retrieval tasks.  It uses a query instruction prefix
// to separate the "search intent" from the "passage content", which greatly
// improves asymmetric search quality.
const MODEL_ID = "Xenova/bge-small-en-v1.5";
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

let pipelinePromise: Promise<
  (texts: string[], options?: { pooling: string; normalize: boolean }) => Promise<{ tolist(): Promise<number[][]> }>
> | null = null;

function getEmbeddingPipeline() {
  pipelinePromise ??= (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const extractor = await pipeline("feature-extraction", MODEL_ID, {
      dtype: "fp32",
    });
    return extractor as unknown as (
      texts: string[],
      options?: { pooling: string; normalize: boolean },
    ) => Promise<{ tolist(): Promise<number[][]> }>;
  })();
  return pipelinePromise;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Embed a search query (with the BGE instruction prefix for better retrieval).
 * Returns a 384-dimensional normalised vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getEmbeddingPipeline();
  const cleaned = cleanText(text);
  // Queries get the instruction prefix; passages do NOT.
  const output = await extractor([QUERY_PREFIX + cleaned], {
    pooling: "mean",
    normalize: true,
  });
  const vectors = await output.tolist();
  return vectors[0];
}

/**
 * Embed passage texts (no prefix — these are the documents being searched).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getEmbeddingPipeline();
  const cleaned = texts.map(cleanText);
  const output = await extractor(cleaned, { pooling: "mean", normalize: true });
  return output.tolist();
}

/**
 * Take an array of chunks and return them enriched with embedding vectors.
 * Processes in batches to avoid OOM on large documents.
 */
export async function embedChunks(
  chunks: Chunk[],
  batchSize = 32,
): Promise<EmbeddedChunk[]> {
  const results: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text);
    const embeddings = await embedTexts(texts);

    for (let j = 0; j < batch.length; j++) {
      results.push({ ...batch[j], embedding: embeddings[j] });
    }
  }

  return results;
}
