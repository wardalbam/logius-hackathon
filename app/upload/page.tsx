import Link from "next/link";
import { UploadForm } from "./upload-form";

export default function UploadPage() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16 gap-8">
      <h1 className="text-2xl font-bold">Upload PDF</h1>
      <p className="text-sm text-gray-500 text-center max-w-xl">
        Upload een PDF-bestand. Na upload wordt het document direct geïndexeerd en is het doorzoekbaar op de zoekpagina.
      </p>

      <UploadForm />

      <Link href="/search" className="text-sm text-blue-600 hover:underline">
        Naar zoeken
      </Link>
    </main>
  );
}
