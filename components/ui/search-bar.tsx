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
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
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
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-end gap-2 rounded-3xl border border-input bg-background px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring transition-shadow",
        className
      )}
    >
      <textarea
        ref={textareaRef}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none overflow-y-auto bg-transparent outline-none text-base font-bold py-1 pl-2"
      />
      <Button
        type="submit"
        variant="outline"
        disabled={!query.trim()}
        className="cursor-pointer h-9 w-9 rounded-full p-0 bg-primary text-primary-foreground hover:bg-primary/10 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed w-full max-w-22"
      >
        <Search className="h-4 w-4" /> Zoeken
      </Button>
    </form>
  );
}
