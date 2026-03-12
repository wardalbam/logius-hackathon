"use client";

import { SearchBar } from "@/components/ui/search-bar";
import { type ReactNode, useState, useTransition } from "react";
import type { SearchResult } from "../services/db-service";
import { keywordSearch, semanticSearch } from "./actions";

type SearchMode = "keyword" | "semantic";

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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("keyword");
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSearch(q: string) {
    setQuery(q);
    startTransition(async () => {
      const hits =
        mode === "keyword"
          ? await keywordSearch(q)
          : await semanticSearch(q);
      setResults(hits);
      setSearched(true);
    });
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl">
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
      </div>

      <SearchBar
        placeholder={mode === "keyword" ? "Zoek op trefwoord..." : "Zoek op betekenis..."}
        onSearch={handleSearch}
        className="w-full"
      />

      {isPending && (
        <p className="text-sm text-gray-400 animate-pulse text-center">
          Zoeken…
        </p>
      )}

      {searched && !isPending && results.length === 0 && (
        <p className="text-sm text-gray-500 text-center">
          Geen resultaten gevonden.
        </p>
      )}

      {results.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-600">
            Gevonden in {results.length} document{results.length !== 1 && "en"}
          </h2>
          {results.map((r) => (
            <div
              key={r.source}
              className="border rounded-lg p-4 flex flex-col gap-2 text-sm hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 truncate">
                  {r.source}
                </span>
                <span className="text-xs text-gray-400 font-mono shrink-0 ml-2">
                  pagina {r.pageNumber}
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed">
                {mode === "keyword" ? highlightText(r.text, query) : r.text}
              </p>
              {mode === "semantic" && (
                <span className="text-xs text-gray-400 font-mono">
                  score: {r.rank.toFixed(4)}
                </span>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
