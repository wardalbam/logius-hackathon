import { extractMetadataFromText } from "@/app/services/ai-metadata-service";
import { getChunksFromPdf } from "@/app/services/pdfReader-service";
import fs from "node:fs";
import path from "node:path";
import {
  countEmbeddings,
  getAllSources,
  hasEmbeddings,
  rebuildFtsIndex,
  saveEmbeddedChunks,
} from "../services/db-service";
import { embedChunks } from "../services/embedding-service";
import SearchClient from "./search-client";

const DATA_DIR = path.join(process.cwd(), "data");

/** Discover all PDFs in the data folder. */
function getPdfPaths(): string[] {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => path.join("data", f));
}

export default async function SearchPage() {
  const pdfPaths = getPdfPaths();
  let needsFtsRebuild = false;

  // Index every PDF that isn't in the DB yet
  for (const pdfPath of pdfPaths) {
    const source = path.basename(pdfPath);
    if (hasEmbeddings(source)) continue;

    const chunks = await getChunksFromPdf(pdfPath, {
      maxWords: 100,
      overlapSentences: 2,
    });
    const embedded = await embedChunks(chunks);

    // Extract metadata from the first few chunks to get document-level metadata
    let documentMetadata = {
      tags: [] as string[],
      authors: [] as string[],
      publishDate: null as string | null,
    };

    if (embedded.length > 0) {
      // Use first significant chunk for metadata extraction
      const firstChunk = embedded[0];
      const sampleText = embedded
        .slice(0, Math.min(3, embedded.length))
        .map((c) => c.text)
        .join(" ");

      try {
        documentMetadata = await extractMetadataFromText(sampleText, source);
      } catch (error) {
        console.error(`Error extracting metadata for ${source}:`, error);
      }
    }

    // Add metadata to all chunks of this document
    const enrichedChunks = embedded.map((chunk) => ({
      ...chunk,
      tags: documentMetadata.tags,
      authors: documentMetadata.authors,
      publishDate: documentMetadata.publishDate || undefined,
    }));

    saveEmbeddedChunks(enrichedChunks);
    needsFtsRebuild = true;
  }

  if (needsFtsRebuild) rebuildFtsIndex();

  const sources = getAllSources();
  const totalChunks = countEmbeddings();

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16 gap-8">
      <h1 className="text-2xl font-bold">Doorzoek documenten</h1>
      <p className="text-sm text-gray-500">
        {sources.length} document{sources.length !== 1 && "en"} geïndexeerd
        ({totalChunks} chunks)
      </p>

      {/* Keyword search — shows top chunk per document */}
      <SearchClient />
    </main>
  );
}
