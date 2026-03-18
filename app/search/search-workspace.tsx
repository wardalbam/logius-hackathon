"use client";

import SearchClient from "./search-client";
import { useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Tags,
  Trash2,
  User,
} from "lucide-react";
import type { DocumentMetadataSummary } from "../services/db-service";

type UploadResponse = {
  ok: boolean;
  message: string;
  source?: string;
  chunks?: number;
  tags?: string[];
  authors?: string[];
  publishDate?: string | null;
};

type DeleteResponse = {
  ok: boolean;
  message: string;
};

interface SearchWorkspaceProps {
  initialDocuments: DocumentMetadataSummary[];
}

function getDocumentImportanceScore(document: DocumentMetadataSummary): number {
  let score = 0;
  score += Math.min(document.tags.length, 4);
  score += Math.min(document.authors.length, 2);
  if (document.publishDate) score += 1;
  return score;
}

export default function SearchWorkspace({
  initialDocuments,
}: Readonly<SearchWorkspaceProps>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadOk, setUploadOk] = useState(false);
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedSidebarTags, setSelectedSidebarTags] = useState<Set<string>>(new Set());

  const allSidebarTags = useMemo(
    () =>
      Array.from(
        new Set(
          documents.flatMap((doc) => doc.tags).filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [documents],
  );

  function toggleSidebarTag(tag: string) {
    setSelectedSidebarTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  const filteredDocuments = useMemo(() => {
    const list = documents.filter((document) => {
      if (selectedSidebarTags.size === 0) return true;
      return Array.from(selectedSidebarTags).some((tag) => document.tags.includes(tag));
    });

    return list.sort((a, b) => {
      const scoreA = getDocumentImportanceScore(a);
      const scoreB = getDocumentImportanceScore(b);

      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.source.localeCompare(b.source);
    });
  }, [documents, selectedSidebarTags]);

  async function uploadFile(file: File) {
    setIsUploading(true);
    setUploadMessage("");

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as UploadResponse;

      setUploadOk(data.ok);
      setUploadMessage(data.message);

      if (data.ok && data.source) {
        const uploadedSource = data.source;
        setDocuments((prev) => {
          const nextDocument: DocumentMetadataSummary = {
            source: uploadedSource,
            tags: data.tags ?? [],
            authors: data.authors ?? [],
            publishDate: data.publishDate ?? null,
          };

          const existingIndex = prev.findIndex((doc) => doc.source === uploadedSource);
          if (existingIndex === -1) {
            return [...prev, nextDocument];
          }

          const next = [...prev];
          next[existingIndex] = nextDocument;
          return next;
        });
      }
    } catch {
      setUploadOk(false);
      setUploadMessage("Upload mislukt. Probeer opnieuw.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteDocument(source: string) {
    const confirmed = globalThis.confirm(`Weet je zeker dat je ${source} wilt verwijderen?`);
    if (!confirmed) return;

    setUploadMessage("");

    try {
      const response = await fetch(`/api/files/${encodeURIComponent(source)}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as DeleteResponse;

      if (!response.ok || !data.ok) {
        setUploadOk(false);
        setUploadMessage(data.message || "Verwijderen mislukt. Probeer opnieuw.");
        return;
      }

      setUploadOk(true);
      setUploadMessage(data.message);
      setDocuments((prev) => prev.filter((document) => document.source !== source));
    } catch {
      setUploadOk(false);
      setUploadMessage("Verwijderen mislukt. Probeer opnieuw.");
    }
  }

  async function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    event.target.value = "";
  }

  async function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  return (
    <main className="min-h-screen bg-zinc-100">
      <div className="mx-auto flex w-full max-w-[1600px] gap-4 px-4 py-4">
        <aside
          className={`sticky top-4 self-start h-[calc(100vh-2rem)] rounded-2xl border border-zinc-800/15 bg-gradient-to-b from-white/50 to-white/25 backdrop-blur-md transition-all duration-200 ${
            isCollapsed ? "w-20" : "w-[360px]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-800/10 px-4 py-4">
            {!isCollapsed && (
              <h2 className="text-lg font-extrabold tracking-tight text-gray-900">
                Bestanden
              </h2>
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-gray-700 transition-colors hover:bg-white/50"
              aria-label={isCollapsed ? "Sidebar openen" : "Sidebar inklappen"}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4 transition-transform duration-200 ease-out hover:scale-110" />
              ) : (
                <PanelLeftClose className="h-4 w-4 transition-transform duration-200 ease-out hover:scale-110" />
              )}
            </button>
          </div>

          {isCollapsed && (
            <div className="flex flex-col items-center gap-2 px-2 py-4">
              {filteredDocuments.slice(0, 6).map((document) => (
                <div
                  key={document.source}
                  title={document.source}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/50 text-xs font-extrabold text-gray-800"
                >
                  {document.source.slice(0, 1).toUpperCase()}
                </div>
              ))}
              {filteredDocuments.length > 6 && (
                <div className="text-[10px] font-bold text-gray-600">+{filteredDocuments.length - 6}</div>
              )}
            </div>
          )}

          {!isCollapsed && (
            <div className="flex h-[calc(100%-4.5rem)] flex-col gap-4 p-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={handleDrop}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                  isDragActive
                    ? "border-black/70 bg-zinc-900/10"
                    : "border-zinc-800/30 bg-zinc-900/5"
                }`}
              >
                <p className="text-sm font-bold text-gray-900">
                  Sleep PDF hierheen
                </p>
                <p className="mt-1 text-xs text-gray-500">of kies een bestand</p>

                <span className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-zinc-800">
                  <span>Kies PDF</span>
                </span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleInputChange}
                className="hidden"
              />

              {isUploading && (
                <p className="text-sm font-semibold text-gray-600">Uploaden en indexeren...</p>
              )}

              {uploadMessage && (
                <p className={`text-sm font-semibold ${uploadOk ? "text-green-700" : "text-red-600"}`}>
                  {uploadMessage}
                </p>
              )}

              {allSidebarTags.length > 0 && (
                <div className="rounded-xl bg-white/35 p-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-zinc-400/40 bg-white/70 px-3 py-2 text-xs font-bold text-zinc-700 hover:border-black/20"
                      >
                        <span>
                          Filter op tags
                          {selectedSidebarTags.size > 0 ? ` (${selectedSidebarTags.size})` : ""}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      <DropdownMenuLabel>Filter op tags</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {allSidebarTags.map((tag) => (
                        <DropdownMenuCheckboxItem
                          key={tag}
                          checked={selectedSidebarTags.has(tag)}
                          onCheckedChange={() => toggleSidebarTag(tag)}
                        >
                          #{tag}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                      <button
                        type="button"
                        onClick={() => setSelectedSidebarTags(new Set())}
                        className="w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                      >
                        Reset filters
                      </button>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {filteredDocuments.map((document) => {
                  return (
                  <div
                    key={document.source}
                    className="rounded-xl border border-zinc-800/10 bg-white/30 px-3 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-zinc-500" />
                      <p className="truncate text-sm font-extrabold text-gray-900" title={document.source}>
                        {document.source}
                      </p>
                      <span className="ml-auto rounded-full border border-zinc-300/70 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                        PDF
                      </span>
                    </div>

                    {document.authors.length > 0 && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600">
                        <User className="h-3 w-3" />
                        <p className="truncate">Auteur: {document.authors.join(", ")}</p>
                      </div>
                    )}

                    {document.publishDate && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600">
                        <CalendarDays className="h-3 w-3" />
                        <p>Publicatie: {document.publishDate}</p>
                      </div>
                    )}

                    {document.tags.length > 0 && (
                      <div className="mt-2">
                        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500">
                          <Tags className="h-3 w-3" />
                          <span>Tags</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                        {document.tags.slice(0, 4).map((tag) => (
                          <span
                            key={`${document.source}-${tag}`}
                            className="rounded-full border border-zinc-400/40 bg-white/50 px-2 py-0.5 text-[10px] font-semibold text-zinc-700"
                          >
                            #{tag}
                          </span>
                        ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(document.source)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-300/70 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-white"
                        aria-label={`Verwijder ${document.source}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Verwijder
                      </button>
                    </div>
                  </div>
                  );
                })}

                {filteredDocuments.length === 0 && (
                  <div className="rounded-xl px-3 py-4">
                    <p className="text-sm font-medium text-gray-500">
                      Geen bestanden gevonden voor de gekozen tags.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        <section className="flex h-[calc(100vh-2rem)] flex-1 overflow-hidden p-8">
          <SearchClient />
        </section>
      </div>
    </main>
  );
}
