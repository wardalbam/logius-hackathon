"use server";

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
