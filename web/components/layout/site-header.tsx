"use client";

import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-semibold">
          Reddit Sentiment Analyzer
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/compare" className="hover:text-foreground">
            Comparison
          </Link>
          <Link href="/posts" className="hover:text-foreground">
            Post Explorer
          </Link>
          <Link href="/methodology" className="hover:text-foreground">
            Methodology
          </Link>
        </nav>
      </div>
    </header>
  );
}
