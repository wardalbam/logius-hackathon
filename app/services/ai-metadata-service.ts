import { GoogleGenerativeAI } from "@google/generative-ai";
import "server-only";

interface MetadataExtraction {
  tags: string[];
  authors: string[];
  publishDate: string | null;
}

interface AIParsedItem {
  source?: string;
  pageNumber?: number;
  relevanceScore?: number;
  korteSamenvattingQuery?: string;
  algemeneSamenvatting?: string;
  belangrijksteBevindingen?: string[];
}

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

function asArrayFromUnknown(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;

  const withCollections = value as { results?: unknown[]; items?: unknown[] };
  if (Array.isArray(withCollections.results)) return withCollections.results;
  if (Array.isArray(withCollections.items)) return withCollections.items;
  return null;
}

function tryParseJson(text: string): unknown[] | null {
  try {
    const parsed = JSON.parse(text);
    return asArrayFromUnknown(parsed);
  } catch {
    return null;
  }
}

function extractMatchAndParse(text: string, pattern: RegExp): unknown[] | null {
  const match = pattern.exec(text);
  if (!match) return null;
  return tryParseJson(match[0]);
}

function extractJsonArray(text: string): unknown[] | null {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

  const direct = tryParseJson(cleaned);
  if (direct) return direct;

  const fromArrayMatch = extractMatchAndParse(cleaned, /\[[\s\S]*\]/);
  if (fromArrayMatch) return fromArrayMatch;

  return extractMatchAndParse(cleaned, /\{[\s\S]*\}/);
}

function normalizeAiItem(
  item: AIParsedItem,
  candidates: Array<{ source: string; pageNumber: number; text: string }>,
): {
  source: string;
  pageNumber: number;
  relevanceScore: number;
  korteSamenvattingQuery: string;
  algemeneSamenvatting: string;
  belangrijksteBevindingen: string[];
} | null {
  const source = typeof item.source === "string" ? item.source.trim() : "";
  const candidateBySource = source
    ? candidates.find((candidate) => candidate.source === source)
    : undefined;

  if (!source || !candidateBySource) {
    return null;
  }

  const pageNumber =
    typeof item.pageNumber === "number" && Number.isFinite(item.pageNumber)
      ? item.pageNumber
      : candidateBySource.pageNumber;

  const relevanceScore =
    typeof item.relevanceScore === "number" && Number.isFinite(item.relevanceScore)
      ? Math.max(0, Math.min(1, item.relevanceScore))
      : 0.5;

  const korteSamenvattingQuery =
    typeof item.korteSamenvattingQuery === "string" && item.korteSamenvattingQuery.trim().length > 0
      ? item.korteSamenvattingQuery.trim()
      : candidateBySource.text.slice(0, 180);

  const algemeneSamenvatting =
    typeof item.algemeneSamenvatting === "string" && item.algemeneSamenvatting.trim().length > 0
      ? item.algemeneSamenvatting.trim()
      : candidateBySource.text.slice(0, 500);

  const belangrijksteBevindingen = Array.isArray(item.belangrijksteBevindingen)
    ? item.belangrijksteBevindingen.filter((finding) => typeof finding === "string")
    : [];

  return {
    source,
    pageNumber,
    relevanceScore,
    korteSamenvattingQuery,
    algemeneSamenvatting,
    belangrijksteBevindingen,
  };
}

/**
 * Extract metadata (tags, authors, publish date) from document text using Gemini.
 */
export async function extractMetadataFromText(
  text: string,
  documentName: string,
): Promise<MetadataExtraction> {
  try {
    const prompt = `Analyze the following document text and extract metadata. Return a JSON object with the following structure:
{
  "tags": ["tag1", "tag2", ...],
  "authors": ["author1", "author2", ...],
  "publishDate": "YYYY-MM-DD" or null
}

Guidelines:
- tags: Extract 3-7 relevant topic tags that describe the document content
- authors: Extract author names if mentioned in the text. If no authors are found, return an empty array.
- publishDate: Extract the publication date if found in the text in YYYY-MM-DD format. If not found, return null.

Document name: ${documentName}

Text:
${text}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON from the response
    const jsonMatch = /\{[\s\S]*\}/.exec(responseText);
    if (!jsonMatch) {
      return { tags: [], authors: [], publishDate: null };
    }

    const extracted = JSON.parse(jsonMatch[0]) as MetadataExtraction;
    return {
      tags: Array.isArray(extracted.tags) ? extracted.tags : [],
      authors: Array.isArray(extracted.authors) ? extracted.authors : [],
      publishDate: extracted.publishDate || null,
    };
  } catch (error) {
    console.error("Error extracting metadata:", error);
    return { tags: [], authors: [], publishDate: null };
  }
}

/**
 * Use AI to search documents semantically and restructure results with insights
 */
export async function aiSearch(
  query: string,
  searchResults: Array<{ text: string; source: string; pageNumber: number }>,
): Promise<
  Array<{
    source: string;
    pageNumber: number;
    relevanceScore: number;
    korteSamenvattingQuery: string;
    algemeneSamenvatting: string;
    belangrijksteBevindingen: string[];
  }>
> {
  if (searchResults.length === 0) {
    return [];
  }

  try {
    const resultsText = searchResults
      .map((r) => `Bron: ${r.source}\nPagina: ${r.pageNumber}\nInhoud: ${r.text}`)
      .join("\n\n---\n\n");

    const prompt = `Gebruikersvraag: "${query}"

Je krijgt kandidaatfragmenten uit verschillende documenten. Bepaal ZELF of elk fragment relevant is voor de vraag.

Instructies:
- Geef ALLEEN resultaten terug die inhoudelijk relevant zijn voor de vraag.
- Gebruik een relevanceScore tussen 0 en 1.
- Neem alleen items op met relevanceScore >= 0.35.
- Sorteer aflopend op relevanceScore.
- Maak 3 duidelijke onderdelen:
  1) korteSamenvattingQuery: korte samenvatting van wat relevant is voor de gebruikersvraag (1-2 zinnen)
  2) algemeneSamenvatting: uitgebreidere algemene samenvatting van document/onderzoek (4-6 zinnen)
  3) belangrijksteBevindingen: lijst met kernbevindingen (0-5 items, leeg als niet expliciet aanwezig)

Geef ALLEEN JSON terug als array met objecten:
[
  {
    "source": "documentnaam.pdf",
    "pageNumber": 3,
    "relevanceScore": 0.82,
    "korteSamenvattingQuery": "Korte samenvatting van relevantie voor de vraag",
    "algemeneSamenvatting": "Uitgebreidere samenvatting (4-6 zinnen) van document/onderzoek",
    "belangrijksteBevindingen": ["bevinding 1", "bevinding 2"]
  }
]

Als niets relevant is, geef [] terug.

Kandidaatresultaten:
${resultsText}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const extractedArray = extractJsonArray(responseText);
    if (!extractedArray) {
      return [];
    }

    const parsed = extractedArray as AIParsedItem[];

    const normalized = parsed
      .map((item) => normalizeAiItem(item, searchResults))
      .filter(
        (
          item,
        ): item is {
          source: string;
          pageNumber: number;
          relevanceScore: number;
          korteSamenvattingQuery: string;
          algemeneSamenvatting: string;
          belangrijksteBevindingen: string[];
        } => item !== null,
      );

    const deduplicated = new Map<string, (typeof normalized)[number]>();
    for (const item of normalized) {
      if (item.relevanceScore < 0.35) continue;

      const key = `${item.source}::${item.pageNumber}`;
      const existing = deduplicated.get(key);
      if (!existing || item.relevanceScore > existing.relevanceScore) {
        deduplicated.set(key, item);
      }
    }

    return [...deduplicated.values()]
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (error) {
    const errorMsg = String(error);
    if (errorMsg.includes("429") || errorMsg.includes("quota")) {
      throw error;
    }
    console.error("Error in AI search:", error);
    return [];
  }
}
