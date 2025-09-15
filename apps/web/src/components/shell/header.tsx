"use client";

import Link from "next/link";
import { Nav } from "./nav";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        {/* Logo and main nav */}
        <div className="flex items-center space-x-8">
          <Link
            href="/"
            className="flex items-center space-x-2 font-bold text-xl"
            aria-label="Core Directory Engine - Home"
          >
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                CD
              </span>
            </div>
            <span className="hidden sm:inline">Core Directory</span>
          </Link>

          <Nav isAuthenticated={false} className="hidden md:flex" />
        </div>
      </div>
    </header>
  );
}
