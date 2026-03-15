import Database from "better-sqlite3";
import path from "node:path";
import "server-only";
import type { EmbeddedChunk } from "./embedding-service";

// ── Database path ────────────────────────────────────────────────────────────

const DB_PATH = path.join(process.cwd(), "data", "embeddings.db");

// ── Singleton connection ─────────────────────────────────────────────────────

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL"); // faster concurrent reads
    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id          TEXT    NOT NULL,
        source      TEXT    NOT NULL,
        pageNumber  INTEGER NOT NULL,
        chunkIndex  INTEGER NOT NULL,
        text        TEXT    NOT NULL,
        embedding   BLOB    NOT NULL,
        tags        TEXT,
        authors     TEXT,
        publishDate TEXT,
        PRIMARY KEY (source, chunkIndex)
      );
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source);
    `);

    // ── FTS5 full-text search index ────────────────────────────────────────
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS embeddings_fts USING fts5(
        text,
        content='embeddings',
        content_rowid='rowid',
        tokenize='unicode61'
      );
    `);

    // Triggers to keep the FTS index in sync with the main table
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS embeddings_ai AFTER INSERT ON embeddings BEGIN
        INSERT INTO embeddings_fts(rowid, text) VALUES (new.rowid, new.text);
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS embeddings_ad AFTER DELETE ON embeddings BEGIN
        INSERT INTO embeddings_fts(embeddings_fts, rowid, text) VALUES('delete', old.rowid, old.text);
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS embeddings_au AFTER UPDATE ON embeddings BEGIN
        INSERT INTO embeddings_fts(embeddings_fts, rowid, text) VALUES('delete', old.rowid, old.text);
        INSERT INTO embeddings_fts(rowid, text) VALUES (new.rowid, new.text);
      END;
    `);
  }
  return db;
}


/** Convert a number[] (384 floats) → Buffer for BLOB storage. */
function serialiseEmbedding(vec: number[]): Buffer {
  return Buffer.from(new Float32Array(vec).buffer);
}

/** Convert a BLOB Buffer back to number[]. */
function deserialiseEmbedding(buf: Buffer): number[] {
  const floats = new Float32Array(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
  return Array.from(floats);
}


/**
 * Save an array of embedded chunks to the database.
 * Uses an upsert so re-indexing the same PDF overwrites old rows.
 */
export function saveEmbeddedChunks(chunks: EmbeddedChunk[]): void {
  const conn = getDb();

  const insert = conn.prepare(`
    INSERT OR REPLACE INTO embeddings (id, source, pageNumber, chunkIndex, text, embedding, tags, authors, publishDate)
    VALUES (@id, @source, @pageNumber, @chunkIndex, @text, @embedding, @tags, @authors, @publishDate)
  `);

  const insertMany = conn.transaction((rows: EmbeddedChunk[]) => {
    for (const row of rows) {
      insert.run({
        id: row.id,
        source: row.source,
        pageNumber: row.pageNumber,
        chunkIndex: row.chunkIndex,
        text: row.text,
        embedding: serialiseEmbedding(row.embedding),
        tags: row.tags ? JSON.stringify(row.tags) : null,
        authors: row.authors ? JSON.stringify(row.authors) : null,
        publishDate: row.publishDate || null,
      });
    }
  });

  insertMany(chunks);
}

/**
 * Retrieve all embedded chunks for a given source file.
 * Returns them ordered by chunkIndex.
 */
export function getEmbeddedChunksBySource(source: string): EmbeddedChunk[] {
  const conn = getDb();
  const rows = conn
    .prepare(
      `SELECT id, source, pageNumber, chunkIndex, text, embedding, tags, authors, publishDate
       FROM embeddings
       WHERE source = ?
       ORDER BY chunkIndex`,
    )
    .all(source) as {
    id: string;
    source: string;
    pageNumber: number;
    chunkIndex: number;
    text: string;
    embedding: Buffer;
    tags: string | null;
    authors: string | null;
    publishDate: string | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    pageNumber: r.pageNumber,
    chunkIndex: r.chunkIndex,
    text: r.text,
    embedding: deserialiseEmbedding(r.embedding),
    tags: r.tags ? JSON.parse(r.tags) : undefined,
    authors: r.authors ? JSON.parse(r.authors) : undefined,
    publishDate: r.publishDate || undefined,
  }));
}

/**
 * Retrieve ALL embedded chunks from the database.
 */
export function getAllEmbeddedChunks(): EmbeddedChunk[] {
  const conn = getDb();
  const rows = conn
    .prepare(
      `SELECT id, source, pageNumber, chunkIndex, text, embedding, tags, authors, publishDate
       FROM embeddings
       ORDER BY source, chunkIndex`,
    )
    .all() as {
    id: string;
    source: string;
    pageNumber: number;
    chunkIndex: number;
    text: string;
    embedding: Buffer;
    tags: string | null;
    authors: string | null;
    publishDate: string | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    pageNumber: r.pageNumber,
    chunkIndex: r.chunkIndex,
    text: r.text,
    embedding: deserialiseEmbedding(r.embedding),
    tags: r.tags ? JSON.parse(r.tags) : undefined,
    authors: r.authors ? JSON.parse(r.authors) : undefined,
    publishDate: r.publishDate || undefined,
  }));
}

/**
 * Check whether a source file already has embeddings stored.
 */
export function hasEmbeddings(source: string): boolean {
  const conn = getDb();
  const row = conn
    .prepare(`SELECT 1 FROM embeddings WHERE source = ? LIMIT 1`)
    .get(source) as { 1: number } | undefined;
  return row !== undefined;
}

/**
 * Delete all embeddings for a given source (useful for re-indexing).
 */
export function deleteEmbeddingsBySource(source: string): void {
  const conn = getDb();
  conn.prepare(`DELETE FROM embeddings WHERE source = ?`).run(source);
}

/**
 * Return the total number of embedded chunks stored.
 */
export function countEmbeddings(): number {
  const conn = getDb();
  const row = conn
    .prepare(`SELECT COUNT(*) as count FROM embeddings`)
    .get() as { count: number };
  return row.count;
}

// ── Keyword search (FTS5) ────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  source: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  rank: number; // BM25 relevance score (lower = more relevant)
  tags?: string[]; // JSON array as string
  authors?: string[]; // JSON array as string
  publishDate?: string;
}

/**
 * Search chunks by keyword using SQLite FTS5.
 * Supports multiple words (implicit AND), quoted phrases, and prefix*.
 * Returns results ranked by BM25 relevance, limited to `maxResults`.
 */
export function searchByKeyword(
  query: string,
  maxResults = 20,
): SearchResult[] {
  const conn = getDb();

  const trimmed = query.trim();
  if (!trimmed) return [];

  // Turn the user query into an FTS5 query:
  // Split words → wrap each in quotes → join with AND
  // This avoids FTS5 syntax errors from special characters.
  const terms = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `"${w.replaceAll('"', '""')}"`) // escape any quotes inside a term
    .join(" AND ");

  const rows = conn
    .prepare(
      `SELECT e.id, e.source, e.pageNumber, e.chunkIndex, e.text,
              rank, e.tags, e.authors, e.publishDate
       FROM embeddings_fts
       JOIN embeddings e ON e.rowid = embeddings_fts.rowid
       WHERE embeddings_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    )
    .all(terms, maxResults) as (SearchResult & { tags: string | null; authors: string | null; publishDate: string | null })[];

  return rows.map((r) => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags) : undefined,
    authors: r.authors ? JSON.parse(r.authors) : undefined,
  }));
}

/**
 * Search chunks by keyword, returning only the TOP (most relevant) chunk
 * per source document. This is the main search function for multi-PDF search.
 */
export function searchByKeywordTopPerSource(
  query: string,
  maxSources = 20,
): SearchResult[] {
  const conn = getDb();

  const trimmed = query.trim();
  if (!trimmed) return [];

  const terms = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `"${w.replaceAll('"', '""')}"`)  
    .join(" OR ");

  // Window function: pick the best-ranked row per source
  const rows = conn
    .prepare(
      `WITH ranked AS (
         SELECT e.id, e.source, e.pageNumber, e.chunkIndex, e.text,
                rank, e.tags, e.authors, e.publishDate,
                ROW_NUMBER() OVER (PARTITION BY e.source ORDER BY rank) AS rn
         FROM embeddings_fts
         JOIN embeddings e ON e.rowid = embeddings_fts.rowid
         WHERE embeddings_fts MATCH ?
       )
       SELECT id, source, pageNumber, chunkIndex, text, rank, tags, authors, publishDate
       FROM ranked
       WHERE rn = 1
       ORDER BY rank
       LIMIT ?`,
    )
    .all(terms, maxSources) as (SearchResult & { tags: string | null; authors: string | null; publishDate: string | null })[];

  return rows.map((r) => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags) : undefined,
    authors: r.authors ? JSON.parse(r.authors) : undefined,
  }));
}

/**
 * Return all distinct source filenames stored in the database.
 */
export function getAllSources(): string[] {
  const conn = getDb();
  const rows = conn
    .prepare(`SELECT DISTINCT source FROM embeddings ORDER BY source`)
    .all() as { source: string }[];
  return rows.map((r) => r.source);
}

/**
 * Rebuild the FTS index from the current embeddings table.
 * Call this once after initially populating the DB (before triggers existed).
 */
export function rebuildFtsIndex(): void {
  const conn = getDb();
  conn.exec(`INSERT INTO embeddings_fts(embeddings_fts) VALUES('rebuild');`);
}

// ── Semantic (vector) search ─────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Semantic search: compare a query embedding against all stored chunk
 * embeddings and return the single best-matching chunk per source,
 * sorted by descending similarity.
 */
export function semanticSearchTopPerSource(
  queryEmbedding: number[],
  maxSources = 20,
  minScore = 0.3,
): SearchResult[] {
  const allChunks = getAllEmbeddedChunks();

  // Score every chunk
  const scored = allChunks.map((c) => ({
    id: c.id,
    source: c.source,
    pageNumber: c.pageNumber,
    chunkIndex: c.chunkIndex,
    text: c.text,
    rank: cosineSimilarity(queryEmbedding, c.embedding),
    tags: c.tags,
    authors: c.authors,
    publishDate: c.publishDate,
  }));

  // Keep only the top chunk per source
  const bestPerSource = new Map<string, SearchResult>();
  for (const s of scored) {
    if (s.rank < minScore) continue;
    const existing = bestPerSource.get(s.source);
    if (!existing || s.rank > existing.rank) {
      bestPerSource.set(s.source, s);
    }
  }

  return [...bestPerSource.values()]
    .sort((a, b) => b.rank - a.rank)
    .slice(0, maxSources);
}
