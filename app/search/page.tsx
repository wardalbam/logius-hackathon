import { SearchBar } from "@/components/ui/search-bar";

export default async function SearchPage() {


  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16">
      <SearchBar placeholder="Search..." className="w-full max-w-xl" />
    </main>
  );
}
