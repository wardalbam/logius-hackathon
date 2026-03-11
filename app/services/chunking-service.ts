export interface Chunk {
  documentId: string;
  page: number;
  chunkIndex: number;
  text: string;
}

export function chunkDocument(
  doc: { documentId: string; pages: { page: number; text: string }[] },
  chunkSize = 50
): Chunk[] {
  const chunks: Chunk[] = [];

  for (const { page, text } of doc.pages) {
    const words = text.split(" ");
    let chunkIndex = 0;

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push({
        documentId: doc.documentId,
        page,
        chunkIndex,
        text: words.slice(i, i + chunkSize).join(" "),
      });
      chunkIndex++;
    }
  }

  return chunks;
}
