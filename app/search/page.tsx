import { getChunksFromPdf } from "@/app/services/pdfReader-service";
import { SearchBar } from "@/components/ui/search-bar";
import  ResultCard  from "@/components/ui/result-card";

export default async function SearchPage() {
  const chunks = await getChunksFromPdf(
    // change this path to point to your PDF file in the public directory for testing, e.g. "/my-doc.pdf"
    "tilburg-publicatieportaal__originele-verslag-onderzoek.pdf", 
    { maxWords: 100, overlapSentences: 2 }
  );

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16 gap-8">
      <SearchBar placeholder="Search..." className="w-full max-w-xl" />

      {/* TEST: chunk output */}
      <section className="w-full max-w-3xl flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          Chunks ({chunks.length}) — {chunks[0]?.source}
        </h2>
        {chunks.map((chunk) => (
          <div
            key={`${chunk.id}-${chunk.pageNumber}-${chunk.chunkIndex}`}
            className="border rounded-lg p-4 flex flex-col gap-1 text-sm"
          >
            <div className="flex gap-4 text-xs text-gray-500 font-mono">
              <span>page {chunk.pageNumber}</span>
              <span>chunk #{chunk.chunkIndex}</span>
              <span>{chunk.source}</span>
            </div>
            <p className="text-gray-800 leading-relaxed">{chunk.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
