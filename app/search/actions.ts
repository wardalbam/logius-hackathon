"use server";

import { aiSearch } from "../services/ai-metadata-service";
import {
  countEmbeddings,
  searchByKeywordTopPerSource,
  semanticSearchTopPerSource,
  type SearchResult,
} from "../services/db-service";
import { embedText } from "../services/embedding-service";

export async function keywordSearch(query: string): Promise<SearchResult[]> {
  const count = countEmbeddings();
  if (count === 0) return [];

  return searchByKeywordTopPerSource(query);
}

export async function semanticSearch(query: string): Promise<SearchResult[]> {
  const count = countEmbeddings();
  if (count === 0) return [];

  const queryEmbedding = await embedText(query);
  return semanticSearchTopPerSource(queryEmbedding);
}

export async function aiSearchAction(
  query: string,
): Promise<
  Array<{
    source: string;
    summary: string;
    relevance: string;
    keyPoints: string[];
    text?: string;
  }>
> {
  const count = countEmbeddings();
  if (count === 0) return [];

  // First, do a semantic search to get relevant results
  const queryEmbedding = await embedText(query);
  const searchResults = semanticSearchTopPerSource(queryEmbedding);

  // Restructure with AI insights
  const aiResults = await aiSearch(
    query,
    searchResults.map((r) => ({
      text: r.text,
      source: r.source,
    })),
  );

  // Merge search results with AI insights
  return aiResults.map((result) => {
    const originalResult = searchResults.find((r) => r.source === result.source);
    return {
      ...result,
      text: originalResult?.text,
    };
  });
}
