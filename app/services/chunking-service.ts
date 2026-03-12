export interface Chunk {
  id: string; // <-- this is the source document's ID
  chunkIndex: number;
  text: string;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// pass data as a json array of objects with id and text properties
// json input example -> [ {"id": "doc1", "text": "This is the first document."}]
export function chunkDocuments(
  docs: { id: string; text: string }[],
  maxWords = 100,
  overlapSentences = 2
): Chunk[] {
  const chunks: Chunk[] = [];

  for (const { id, text } of docs) {
    const sentences = splitSentences(text);
    let chunkIndex = 0;
    let i = 0;

    while (i < sentences.length) {
      const chunkSentences: string[] = [];
      let wordCount = 0;

      let j = i;
      while (j < sentences.length && wordCount < maxWords) {
        chunkSentences.push(sentences[j]);
        wordCount += sentences[j].split(" ").length;
        j++;
      }

      chunks.push({ id, chunkIndex, text: chunkSentences.join(" ") });
      chunkIndex++;
      i += Math.max(1, chunkSentences.length - overlapSentences);
    }
  }

  return chunks;
}

