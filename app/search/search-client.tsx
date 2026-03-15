"use client";

import { SearchBar } from "@/components/ui/search-bar";
import { type ReactNode, useState, useTransition } from "react";
import type { SearchResult } from "../services/db-service";
import { aiSearchAction, keywordSearch, semanticSearch } from "./actions";

type SearchMode = "keyword" | "semantic" | "ai";

interface AIResult {
  source: string;
  summary: string;
  relevance: string;
  keyPoints: string[];
  text?: string;
}

/** Wrap every occurrence of any keyword in a <mark> tag. */
function highlightText(text: string, query: string): ReactNode {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`));
  if (words.length === 0) return text;

  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  const parts = text.split(pattern);

  let markCounter = 0;
  return parts.map((part) => {
    if (pattern.test(part)) {
      markCounter++;
      return (
        <mark key={`hl-${markCounter}`} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">
          {part}
        </mark>
      );
    }
    return part;
  });
}

export default function SearchClient() {
  const [results, setResults] = useState<SearchResult[] | AIResult[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("keyword");
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Extract all unique tags from results
  const allTags = Array.from(
    new Set(
      results.flatMap((r: any) => r.tags || []).filter(Boolean),
    ),
  ).sort();

  // Filter results by selected tags
  const filteredResults = results.filter((r: any) => {
    if (selectedTags.size === 0) return true;
    const resultTags = r.tags || [];
    return Array.from(selectedTags).some((tag) => resultTags.includes(tag));
  });

  function toggleTag(tag: string) {
    const newTags = new Set(selectedTags);
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }
    setSelectedTags(newTags);
  }

  function handleSearch(q: string) {
    setQuery(q);
    setSelectedTags(new Set());
    startTransition(async () => {
      let hits: SearchResult[] | AIResult[] = [];
      if (mode === "keyword") {
        hits = await keywordSearch(q);
      } else if (mode === "semantic") {
        hits = await semanticSearch(q);
      } else {
        hits = await aiSearchAction(q);
      }
      setResults(hits);
      setSearched(true);
    });
  }

  const isAIMode = mode === "ai";
  const isKeywordMode = mode === "keyword";

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
      {/* Mode toggle */}
      <div className="flex justify-center gap-1 rounded-lg bg-gray-100 p-1 w-fit mx-auto">
        <button
          type="button"
          onClick={() => setMode("keyword")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === "keyword"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Trefwoord
        </button>
        <button
          type="button"
          onClick={() => setMode("semantic")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === "semantic"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Semantisch
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === "ai"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          AI
        </button>
      </div>

      <SearchBar
        placeholder={
          mode === "keyword"
            ? "Zoek op trefwoord..."
            : mode === "semantic"
              ? "Zoek op betekenis..."
              : "Vraag Claude..."
        }
        onSearch={handleSearch}
        className="w-full"
      />

      {isPending && (
        <p className="text-sm text-gray-400 animate-pulse text-center">
          Zoeken…
        </p>
      )}

      {/* Tag filter */}
      {searched && !isPending && allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                selectedTags.has(tag)
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {searched && !isPending && results.length === 0 && (
        <p className="text-sm text-gray-500 text-center">
          Geen resultaten gevonden.
        </p>
      )}

      {searched && !isPending && results.length > 0 && filteredResults.length === 0 && (
        <p className="text-sm text-gray-500 text-center">
          Geen resultaten met geselecteerde tags.
        </p>
      )}

      {filteredResults.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-600">
            Gevonden in {filteredResults.length} document{filteredResults.length !== 1 && "en"}
          </h2>
          {filteredResults.map((r: any, idx) => (
            <div
              key={`${r.source}-${idx}`}
              className="border rounded-lg p-4 flex flex-col gap-3 text-sm hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 truncate">
                  {r.source}
                </span>
                {!isAIMode && (
                  <span className="text-xs text-gray-400 font-mono shrink-0 ml-2">
                    pagina {r.pageNumber}
                  </span>
                )}
              </div>

              {isAIMode ? (
                // AI search result format
                <div className="space-y-2">
                  <p className="text-gray-700 font-medium text-sm">
                    {r.summary}
                  </p>
                  <p className="text-gray-600 text-xs italic">
                    Relevantie: {r.relevance}
                  </p>
                  {r.keyPoints && r.keyPoints.length > 0 && (
                    <ul className="list-disc list-inside text-gray-700">
                      {r.keyPoints.map((point: string, i: number) => (
                        <li key={i} className="text-xs">
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                // Keyword/Semantic search result format
                <p className="text-gray-700 leading-relaxed">
                  {isKeywordMode ? highlightText(r.text, query) : r.text}
                </p>
              )}

              {/* Metadata display */}
              <div className="flex flex-col gap-2 text-xs">
                {!isAIMode && mode === "semantic" && (
                  <span className="text-gray-400 font-mono">
                    score: {r.rank.toFixed(4)}
                  </span>
                )}

                {r.authors && r.authors.length > 0 && (
                  <div className="text-gray-600">
                    <span className="font-semibold">Auteurs:</span>{" "}
                    {r.authors.join(", ")}
                  </div>
                )}

                {r.publishDate && (
                  <div className="text-gray-600">
                    <span className="font-semibold">Gepubliceerd:</span>{" "}
                    {r.publishDate}
                  </div>
                )}

                {r.tags && r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

