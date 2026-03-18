"use client";

import { SearchBar } from "@/components/ui/search-bar";
import { Switch } from "@/components/ui/switch";
import { type ReactNode, useState, useTransition } from "react";
import type { SearchResult } from "../services/db-service";
import { aiSearchAction, semanticSearch } from "./actions";

type SearchMode = "semantic" | "ai";

interface AIResult {
  source: string;
  pageNumber: number;
  korteSamenvattingQuery: string;
  algemeneSamenvatting: string;
  belangrijksteBevindingen: string[];
  text: string;
  authors?: string[];
  publishDate?: string;
}

type ResultItem = SearchResult | AIResult;

function getResultTags(result: ResultItem): string[] {
  if ("tags" in result && Array.isArray(result.tags)) {
    return result.tags;
  }
  return [];
}

function isAIResult(result: ResultItem): result is AIResult {
  return "korteSamenvattingQuery" in result;
}

function highlightBelangrijksteInfo(text: string, query: string): ReactNode {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .map((word) => word.toLowerCase());

  if (words.length === 0) {
    return text;
  }

  const sentences = text.match(/[^.!?\n]+[.!?]?/g) ?? [text];

  return sentences.map((sentence, index) => {
    const lowerSentence = sentence.toLowerCase();
    const isRelevantSentence = words.some((word) => lowerSentence.includes(word));

    if (isRelevantSentence) {
      return (
        <mark
          key={`ai-sentence-${index}-${sentence.length}`}
          className="mr-1 inline rounded bg-amber-200/70 px-1 py-0.5 text-black"
        >
          {sentence}
        </mark>
      );
    }

    return (
      <span key={`ai-sentence-${index}-${sentence.length}`} className="mr-1 inline">
        {sentence}
      </span>
    );
  });
}

const voorgesteldeZoekopdrachten = [
  "Wat zijn de belangrijkste uitkomsten van onderzoek naar de MijnOverheid-app?",
  "Welke gebruiksproblemen worden genoemd bij de MijnOverheid-app?",
  "Wat zegt onderzoek over toegankelijkheid van de MijnOverheid-app?",
];

export default function SearchClient(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props?: Readonly<object>,
) {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("semantic");
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const [aiQuotaExceeded, setAiQuotaExceeded] = useState(false);

  let searchPlaceholder = "Vraag AI over documenten...";
  if (mode === "semantic") {
    searchPlaceholder = "Zoek op betekenis...";
  }

  function handleSearch(q: string) {
    setQuery(q);
    setExpandedSummaries(new Set());
    setAiQuotaExceeded(false);
    startTransition(async () => {
      let hits: ResultItem[] = [];
      if (mode === "semantic") {
        hits = await semanticSearch(q);
      } else {
        const aiResult = await aiSearchAction(q);
        hits = aiResult.results;
        if (aiResult.quotaExceeded) {
          setAiQuotaExceeded(true);
        }
      }
      setResults(hits);
      setSearched(true);
    });
  }

  function handleSuggestedSearch(suggestie: string) {
    setQuery(suggestie);
    handleSearch(suggestie);
  }

  function toggleSummary(summaryKey: string) {
    setExpandedSummaries((prev) => {
      const next = new Set(prev);
      if (next.has(summaryKey)) {
        next.delete(summaryKey);
      } else {
        next.add(summaryKey);
      }
      return next;
    });
  }

  const hasVisibleResults = results.length > 0;
  const hasNoResultsState = searched && !isPending;
  const isSearchIdle = !searched && !isPending;
  const aiResults = results.filter(isAIResult);
  const semanticResults = results.filter((result): result is SearchResult => !isAIResult(result));

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden">
      <div className="shrink-0">
        {/* Mode toggle */}
        <div className="fixed right-4 top-4 z-50 flex items-center gap-3">
          <span className="text-sm font-bold text-gray-700">Ai-mode</span>
          <Switch
            checked={mode === "ai"}
            onCheckedChange={(checked) => setMode(checked ? "ai" : "semantic")}
            aria-label="Zet AI-modus aan of uit"
          />
        </div>

        <div className={`flex flex-col gap-6 ${isSearchIdle ? "items-center justify-center py-10" : "pt-2"}`}>
          <SearchBar
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
            onSearch={handleSearch}
            className={`w-full ${isSearchIdle ? "max-w-3xl" : ""}`}
          />

          {isSearchIdle && (
            <div className="w-full max-w-3xl rounded-2xl bg-zinc-900/5 p-3">
              <div className="grid gap-2 md:grid-cols-3">
              {voorgesteldeZoekopdrachten.map((suggestie) => (
                <button
                  key={suggestie}
                  type="button"
                  onClick={() => handleSuggestedSearch(suggestie)}
                  className="cursor-pointer rounded-xl bg-white/70 px-3 py-3 text-left text-xs font-bold text-gray-700 transition-colors hover:bg-white hover:text-black"
                >
                  {suggestie}
                </button>
              ))}
              </div>
            </div>
          )}

          {isPending && (
            <p className="text-sm text-gray-400 animate-pulse text-center">
              Zoeken…
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pr-1">
        {hasNoResultsState && results.length === 0 && (() => {
          let message = "Geen resultaten gevonden.";
          if (mode === "ai") {
            if (aiQuotaExceeded) {
              message = "AI quota bereikt vandaag. Probeer later opnieuw.";
            } else {
              message = "AI kon geen relevante resultaten genereren voor deze vraag.";
            }
          }
          return <p className="text-sm text-gray-500 text-center">{message}</p>;
        })()}

        {hasVisibleResults && mode === "ai" && (
          <section className="flex flex-col gap-3 pb-2">
            {aiResults.map((result, idx) => {
              const summaryKey = `${result.source}-${result.pageNumber}-${idx}`;
              const isExpanded = expandedSummaries.has(summaryKey);
              const shouldCollapseSummary = result.algemeneSamenvatting.length > 300;
              const displayedSummary = shouldCollapseSummary && !isExpanded
                ? `${result.algemeneSamenvatting.slice(0, 300).trimEnd()}...`
                : result.algemeneSamenvatting;
              const highlightedSnippet = result.text.length > 420
                ? `${result.text.slice(0, 420).trimEnd()}...`
                : result.text;

              return (
                <article
                  key={`${result.source}-${idx}`}
                  className="rounded-2xl border border-zinc-900/10 bg-white/70 p-5 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a
                      href={`/api/files/${encodeURIComponent(result.source)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-base font-extrabold text-black underline underline-offset-4 hover:text-zinc-700"
                      title={`Open ${result.source}`}
                    >
                      {result.source}
                    </a>
                    <span className="rounded-full border border-zinc-300/70 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-600">
                      Pagina {result.pageNumber}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-xl border border-zinc-300/60 bg-white px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                        Belangrijke tekst voor je vraag
                      </p>
                      <div className="mt-1 text-sm leading-relaxed text-zinc-900">
                        {highlightBelangrijksteInfo(highlightedSnippet, query)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-300/60 bg-white px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                        Samenvatting document
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-800">{displayedSummary}</p>
                      {shouldCollapseSummary && (
                        <button
                          type="button"
                          onClick={() => toggleSummary(summaryKey)}
                          className="mt-2 cursor-pointer text-xs font-bold text-zinc-700 underline underline-offset-2 hover:text-black"
                        >
                          {isExpanded ? "Minder tonen" : "Meer lezen"}
                        </button>
                      )}
                    </div>

                    <div className="rounded-xl border border-zinc-300/50 bg-white/60 px-3 py-2">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Meta informatie</p>
                      <div className="flex flex-col gap-2 text-xs">
                        {Array.isArray(result.authors) && result.authors.length > 0 && (
                          <div className="text-gray-600">
                            <span className="font-semibold">Auteurs:</span> {result.authors.join(", ")}
                          </div>
                        )}

                        {typeof result.publishDate === "string" && result.publishDate.length > 0 && (
                          <div className="text-gray-600">
                            <span className="font-semibold">Gepubliceerd:</span> {result.publishDate}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {hasVisibleResults && mode === "semantic" && (
          <section className="flex flex-col gap-3 pb-2">
            <h2 className="text-sm font-semibold text-gray-600">
              Gevonden in {semanticResults.length} document{semanticResults.length !== 1 && "en"}
            </h2>

            {semanticResults.map((result, idx) => {
              const resultTags = getResultTags(result);
              const resultAuthors = Array.isArray(result.authors) ? result.authors : [];
              const resultPublishDate = result.publishDate;

              return (
                <div
                  key={`${result.source}-${idx}`}
                  className="rounded-2xl border border-zinc-900/10 bg-white/60 p-5 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a
                      href={`/api/files/${encodeURIComponent(result.source)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-base font-extrabold text-black underline underline-offset-4 hover:text-zinc-700"
                      title={`Open ${result.source}`}
                    >
                      {result.source}
                    </a>
                    <span className="text-xs font-semibold text-zinc-600">Gevonden op pagina {result.pageNumber}</span>
                  </div>

                  <p className="mt-3 leading-relaxed text-zinc-800">{result.text}</p>

                  <div className="mt-3 rounded-xl border border-zinc-300/50 bg-white/60 px-3 py-2">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Meta informatie</p>
                    <div className="flex flex-col gap-2 text-xs">
                      <span className="font-mono text-gray-400">score: {result.rank.toFixed(4)}</span>

                      {resultAuthors.length > 0 && (
                        <div className="text-gray-600">
                          <span className="font-semibold">Auteurs:</span> {resultAuthors.join(", ")}
                        </div>
                      )}

                      {typeof resultPublishDate === "string" && resultPublishDate.length > 0 && (
                        <div className="text-gray-600">
                          <span className="font-semibold">Gepubliceerd:</span> {resultPublishDate}
                        </div>
                      )}

                      {resultTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {resultTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-zinc-400/60 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

