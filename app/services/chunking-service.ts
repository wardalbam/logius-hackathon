export interface Chunk {
  id: string; // <-- this is the source document's ID
  source: string; // original file name (e.g. "my-doc.pdf")
  pageNumber: number; // 1-based page number the chunk originates from
  chunkIndex: number;
  text: string;
}

interface PageInput {
  id: string;
  source: string;
  pageNumber: number;
  text: string;
}

/** Split text into sentences. Falls back to newline/semicolon boundaries
 *  so headings, bullet points and table rows also become separate units. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;:\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Chunk **all pages of a single document** into overlapping chunks.
 *
 * Pages are processed in order; each sentence remembers which page it
 * came from so that `pageNumber` on the resulting chunk points to the
 * page where the chunk *starts*.
 */
export function chunkDocuments(
  docs: PageInput[],
  maxWords = 100,
  overlapSentences = 2,
): Chunk[] {
  if (docs.length === 0) return [];

  // ── 1. Build a flat list of (sentence, pageNumber) across all pages ──
  const { id, source } = docs[0];

  const allSentences: { text: string; pageNumber: number }[] = [];
  for (const page of docs) {
    if (!page.text.trim()) continue; // skip empty pages
    for (const s of splitSentences(page.text)) {
      allSentences.push({ text: s, pageNumber: page.pageNumber });
    }
  }

  if (allSentences.length === 0) return [];

  // ── 2. Slide a window over the sentence list ─────────────────────────
  const chunks: Chunk[] = [];
  let chunkIndex = 0;
  let i = 0;

  while (i < allSentences.length) {
    const chunkSentences: string[] = [];
    let wordCount = 0;
    const startPage = allSentences[i].pageNumber;

    let j = i;
    while (j < allSentences.length && wordCount < maxWords) {
      chunkSentences.push(allSentences[j].text);
      wordCount += allSentences[j].text.split(" ").length;
      j++;
    }

    chunks.push({
      id,
      source,
      pageNumber: startPage,
      chunkIndex,
      text: chunkSentences.join(" "),
    });
    chunkIndex++;
    i += Math.max(1, chunkSentences.length - overlapSentences);
  }

  return chunks;
}

