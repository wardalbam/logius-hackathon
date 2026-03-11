import "server-only";
import fs from "node:fs";
import path from "node:path";

export interface PdfExtract {
  id: string;
  text: string;
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

  const extract = {
    id,
    text: result.text.replaceAll(/\s+/g, " ").trim(),
  };

  console.log(extract);

  return extract;
}
