import mockData from "./mockdata-pdf-extracts.json";
import { chunkDocuments, Chunk } from "./chunking-service";

const chunks: Chunk[] = chunkDocuments(mockData);

export function search(query: string): Chunk[] {
  const q = query.toLowerCase();
  return chunks.filter((chunk) => chunk.text.toLowerCase().includes(q));
}
