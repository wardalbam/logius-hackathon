import mockData from "./mockdata-pdf-extracts.json";
import { chunkDocument, Chunk } from "./chunking-service";

const chunks: Chunk[] = chunkDocument(mockData);

export function search(query: string): Chunk[] {
  const q = query.toLowerCase();
  return chunks.filter((chunk) => chunk.text.toLowerCase().includes(q));
}
