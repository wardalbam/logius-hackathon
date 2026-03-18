"use server";

import { aiSearch } from "../services/ai-metadata-service";
import {
  countEmbeddings,
  searchByKeywordTopPerSource,
  semanticSearchTopPerSource,
  type SearchResult,
} from "../services/db-service";
import { embedText } from "../services/embedding-service";

const STOPWOORDEN = new Set([
  "de",
  "het",
  "een",
  "en",
  "of",
  "van",
  "voor",
  "met",
  "in",
  "op",
  "aan",
  "naar",
  "door",
  "over",
  "om",
  "te",
  "tot",
  "bij",
  "uit",
  "dat",
  "die",
  "dit",
  "welke",
  "worden",
  "is",
  "zijn",
  "werd",
  "waar",
  "wat",
  "hoe",
  "waarom",
  "wie",
]);

const HIGH_CONFIDENCE_SCORE = 0.62;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOPWOORDEN.has(word));
}

function hasTermOverlap(query: string, text: string): boolean {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return true;

  const textTerms = tokenize(text);
  let overlapCount = 0;

  for (const queryTerm of queryTerms) {
    const hasDirectMatch = textTerms.includes(queryTerm);
    const hasStemLikeMatch =
      queryTerm.length >= 5 &&
      textTerms.some((textTerm) =>
        textTerm.startsWith(queryTerm.slice(0, 5)) ||
        queryTerm.startsWith(textTerm.slice(0, 5)),
      );

    if (hasDirectMatch || hasStemLikeMatch) {
      overlapCount += 1;
    }
  }

  return overlapCount >= 1;
}

function filterRelevantResults(query: string, results: SearchResult[]): SearchResult[] {
  if (results.length === 0) return [];

  const topScore = results[0]?.rank ?? 0;
  const dynamicThreshold = Math.max(0.45, topScore - 0.12);

  return results.filter(
    (result) => {
      if (result.rank < dynamicThreshold) return false;

      const overlap = hasTermOverlap(`${query} ${result.source}`, result.text);
      if (overlap) return true;

      return result.rank >= HIGH_CONFIDENCE_SCORE;
    },
  );
}

export async function keywordSearch(query: string): Promise<SearchResult[]> {
  const count = countEmbeddings();
  if (count === 0) return [];

  return searchByKeywordTopPerSource(query);
}

export async function semanticSearch(query: string): Promise<SearchResult[]> {
  const count = countEmbeddings();
  if (count === 0) return [];

  const queryEmbedding = await embedText(query);
  const rawResults = semanticSearchTopPerSource(queryEmbedding, 24, 0.4);
  return filterRelevantResults(query, rawResults);
}

export interface AISearchResult {
  results: Array<{
    source: string;
    pageNumber: number;
    korteSamenvattingQuery: string;
    algemeneSamenvatting: string;
    belangrijksteBevindingen: string[];
    text: string;
    authors?: string[];
    publishDate?: string;
  }>;
  quotaExceeded?: boolean;
}

export async function aiSearchAction(query: string): Promise<AISearchResult> {
  const count = countEmbeddings();
  if (count === 0) return { results: [] };

  try {
    // Build a richer candidate set (semantic + keyword) so AI can still find
    // relevant documents when embedding similarity is noisy.
    const queryEmbedding = await embedText(query);
    const semanticCandidates = semanticSearchTopPerSource(queryEmbedding, 50, 0.22);
    const keywordCandidates = searchByKeywordTopPerSource(query, 30);

    const bySource = new Map<string, SearchResult>();

    for (const result of semanticCandidates) {
      bySource.set(result.source, result);
    }

    for (const keywordResult of keywordCandidates) {
      if (!bySource.has(keywordResult.source)) {
        bySource.set(keywordResult.source, keywordResult);
      }
    }

    const effectiveResults = [...bySource.values()].slice(0, 30);

    if (effectiveResults.length === 0) {
      return { results: [] };
    }

    // Restructure with AI insights
    const aiResults = await aiSearch(
      query,
      effectiveResults.map((r) => ({
        text: r.text,
        source: r.source,
        pageNumber: r.pageNumber,
      })),
    );

    if (aiResults.length === 0) {
      return { results: [] };
    }

    // Merge search results with AI insights
    const mergedResults = aiResults
      .map((result) => {
        const originalResult = effectiveResults.find(
          (r) => r.source === result.source && r.pageNumber === result.pageNumber,
        ) ?? effectiveResults.find((r) => r.source === result.source);

        if (!originalResult) return null;

        return {
          source: result.source,
          pageNumber: result.pageNumber || originalResult.pageNumber,
          korteSamenvattingQuery:
            result.korteSamenvattingQuery || originalResult.text.slice(0, 180),
          algemeneSamenvatting:
            result.algemeneSamenvatting || originalResult.text.slice(0, 500),
          belangrijksteBevindingen: result.belangrijksteBevindingen || [],
          text: originalResult.text,
          authors: Array.isArray(originalResult.authors) ? originalResult.authors : [],
          publishDate: originalResult.publishDate,
        };
      })
      .filter(
        (
          item,
        ): item is {
          source: string;
          pageNumber: number;
          korteSamenvattingQuery: string;
          algemeneSamenvatting: string;
          belangrijksteBevindingen: string[];
          text: string;
          authors: string[];
          publishDate: string | undefined;
        } => item !== null,
      );

    if (mergedResults.length > 0) {
      return { results: mergedResults };
    }

    return { results: [] };
  } catch (error) {
    const errorMsg = String(error);
    if (errorMsg.includes("429") || errorMsg.includes("quota")) {
      console.warn("AI quota exceeded");
      return { results: [], quotaExceeded: true };
    }

    console.error("Unexpected error in aiSearchAction:", error);
    return { results: [] };
  }
}
