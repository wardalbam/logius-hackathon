"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useRef, useState } from "react";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export function SearchBar({ placeholder = "Search...", onSearch, className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setQuery(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSearch?.(query);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch?.(query);
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex items-end gap-3 justify-center", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground pointer-events-none" />
        <textarea
          ref={textareaRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="w-full rounded-3xl border border-input bg-background pl-11 pr-5 py-3 text-base font-bold shadow-sm outline-none focus:ring-2 focus:ring-ring transition-shadow resize-none overflow-hidden"
        />
      </div>
      <Button variant="outline" className="rounded-full px-6 py-3 text-base font-bold shrink-0 mb-2 bg-primary text-primary-foreground hover:bg-primary/80">
        Search
      </Button>
    </form>
  );
}
