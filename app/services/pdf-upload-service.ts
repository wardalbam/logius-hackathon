import fs from "node:fs/promises";
import path from "node:path";
import "server-only";
import { extractMetadataFromText } from "@/app/services/ai-metadata-service";
import { deleteEmbeddingsBySource, saveEmbeddedChunks } from "@/app/services/db-service";
import { embedChunks } from "@/app/services/embedding-service";
import { getChunksFromPdf } from "@/app/services/pdfReader-service";

const DATA_DIR = path.join(process.cwd(), "data");

export interface UploadResult {
  ok: boolean;
  message: string;
  source?: string;
  chunks?: number;
  tags?: string[];
  authors?: string[];
  publishDate?: string | null;
}

export interface DeleteResult {
  ok: boolean;
  message: string;
}

function sanitizePdfFilename(inputName: string): string {
  const parsed = path.parse(inputName);
  const safeBase = parsed.name
    .replaceAll(/[^a-zA-Z0-9-_]/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 80);

  const base = safeBase || "document";
  return `${base}.pdf`;
}

function addTimestamp(name: string): string {
  const parsed = path.parse(name);
  const stamp = Date.now();
  return `${parsed.name}-${stamp}${parsed.ext}`;
}

export async function uploadAndIndexPdf(file: File): Promise<UploadResult> {
  try {
    if (file.size === 0) {
      return { ok: false, message: "Bestand is leeg." };
    }

    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
    if (!isPdf) {
      return { ok: false, message: "Alleen PDF-bestanden zijn toegestaan." };
    }

    await fs.mkdir(DATA_DIR, { recursive: true });

    const safeName = addTimestamp(sanitizePdfFilename(file.name));
    const absolutePath = path.join(DATA_DIR, safeName);

    const bytes = await file.arrayBuffer();
    await fs.writeFile(absolutePath, Buffer.from(bytes));

    const chunks = await getChunksFromPdf(absolutePath, {
      maxWords: 100,
      overlapSentences: 2,
    });

    if (chunks.length === 0) {
      return { ok: false, message: "Geen tekst gevonden in de PDF." };
    }

    const embedded = await embedChunks(chunks);

    let documentMetadata = {
      tags: [] as string[],
      authors: [] as string[],
      publishDate: null as string | null,
    };

    try {
      const sampleText = embedded
        .slice(0, Math.min(3, embedded.length))
        .map((chunk) => chunk.text)
        .join(" ");

      documentMetadata = await extractMetadataFromText(sampleText, safeName);
    } catch (error) {
      console.error(`Metadata extractie mislukt voor ${safeName}:`, error);
    }

    const enriched = embedded.map((chunk) => ({
      ...chunk,
      tags: documentMetadata.tags,
      authors: documentMetadata.authors,
      publishDate: documentMetadata.publishDate || undefined,
    }));

    deleteEmbeddingsBySource(safeName);
    saveEmbeddedChunks(enriched);

    return {
      ok: true,
      message: "PDF geüpload en geïndexeerd.",
      source: safeName,
      chunks: enriched.length,
      tags: documentMetadata.tags,
      authors: documentMetadata.authors,
      publishDate: documentMetadata.publishDate,
    };
  } catch (error) {
    console.error("Upload en indexering mislukt:", error);
    return {
      ok: false,
      message: "Upload mislukt. Probeer opnieuw.",
    };
  }
}

export async function deletePdfBySource(source: string): Promise<DeleteResult> {
  try {
    const safeName = path.basename(source);

    if (safeName !== source || !safeName.toLowerCase().endsWith(".pdf")) {
      return { ok: false, message: "Ongeldige bestandsnaam." };
    }

    const absolutePath = path.join(DATA_DIR, safeName);

    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      const maybeFsError = error as NodeJS.ErrnoException;
      if (maybeFsError.code !== "ENOENT") {
        throw error;
      }
    }

    deleteEmbeddingsBySource(safeName);

    return {
      ok: true,
      message: "Bestand verwijderd.",
    };
  } catch (error) {
    console.error("Verwijderen mislukt:", error);
    return {
      ok: false,
      message: "Verwijderen mislukt. Probeer opnieuw.",
    };
  }
}
