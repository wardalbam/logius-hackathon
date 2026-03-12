import fs from "node:fs";
import path from "node:path";
import "server-only";
import { chunkDocuments, type Chunk } from "./chunking-service";

export interface PdfPageExtract {
  id: string;
  source: string; // original file name (e.g. "my-doc.pdf")
  pageNumber: number; // 1-based
  text: string;
}

export interface ChunkOptions {
  maxWords?: number;
  overlapSentences?: number;
}

export async function extractPagesFromPdf(filePath: string): Promise<PdfPageExtract[]> {
  const absolutePath = path.resolve(filePath);
  const buffer = fs.readFileSync(absolutePath);

  const id = path.basename(filePath, path.extname(filePath));
  const source = path.basename(filePath);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (opts: { data: Buffer }) => {
      getText(): Promise<{ pages: { num: number; text: string }[]; total: number }>;
    };
  };

  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();

  return result.pages.map((page) => ({
    id,
    source,
    pageNumber: page.num,
    text: page.text.replace(/\s+/g, " ").trim(),
  }));
}

export async function getChunksFromPdf(
  filePath: string,
  options?: ChunkOptions
): Promise<Chunk[]> {
  const pages = await extractPagesFromPdf(filePath);
  return chunkDocuments(pages, options?.maxWords, options?.overlapSentences);
}
