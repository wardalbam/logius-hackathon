import fs from "node:fs";
import path from "node:path";
import "server-only";
import { chunkDocuments, type Chunk } from "./chunking-service";

export interface PdfExtract {
  id: string;
  text: string;
}

export interface ChunkOptions {
  maxWords?: number;
  overlapSentences?: number;
}

export async function extractTextFromPdf(filePath: string): Promise<PdfExtract> {
  const absolutePath = path.resolve(filePath);
  const buffer = fs.readFileSync(absolutePath);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (options: { data: Buffer }) => { getText(): Promise<{ text: string }> };
  };

  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();

  const id = path.basename(filePath, path.extname(filePath));

  return {
    id,
    text: result.text.replaceAll(/\s+/g, " ").trim(),
  };
}

export async function getChunksFromPdf(
  filePath: string,
  options?: ChunkOptions
): Promise<Chunk[]> {
  const extract = await extractTextFromPdf(filePath);
  return chunkDocuments([extract], options?.maxWords, options?.overlapSentences);
}
