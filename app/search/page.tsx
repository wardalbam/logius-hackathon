"use client";

import { SearchBar } from "@/components/ui/search-bar";
import { useState } from "react";

export default function SearchPage() {
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(query: string) {
    setLoading(true);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    setEmbedding(data.embedding);
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16">
      <SearchBar
        placeholder="Search..."
        className="w-full max-w-xl"
        onSearch={handleSearch}
      />
      {loading && <p className="mt-4 text-muted-foreground text-sm">Embedding query...</p>}
      {embedding && !loading && (
        <p className="mt-4 text-muted-foreground text-sm">
          Embedding ready — {embedding.length} dimensions
        </p>
      )}
    </main>
  );
}
