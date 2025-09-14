"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@repo/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@repo/ui";
import { Nav } from "./nav";
import { SearchBar } from "./search-bar";
import { NotificationsBell } from "../social/notifications-bell";
import { AUTH_TESTIDS, THEME_TESTIDS } from "@/lib/testids";
import { createButtonProps } from "@/lib/a11y";

export function Header() {
  const { isSignedIn, isLoaded } = useAuth();
  const { theme, setTheme } = useTheme();

  const themeToggleProps = createButtonProps(
    "Toggle theme",
    THEME_TESTIDS.TOGGLE
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
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

          <Nav isAuthenticated={isSignedIn} className="hidden md:flex" />
        </div>

        {/* Search bar - hidden on mobile */}
        <div className="hidden lg:block flex-1 max-w-md mx-8">
          <SearchBar />
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-2">
          {/* Theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button {...themeToggleProps} variant="ghost" size="sm">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid={THEME_TESTIDS.LIGHT}
                onClick={() => setTheme("light")}
              >
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid={THEME_TESTIDS.DARK}
                onClick={() => setTheme("dark")}
              >
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid={THEME_TESTIDS.SYSTEM}
                onClick={() => setTheme("system")}
              >
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Auth and notifications */}
          {isLoaded && (
            <>
              {isSignedIn ? (
                <div className="flex items-center space-x-2">
                  <NotificationsBell />
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "h-8 w-8",
                      },
                    }}
                  />
                </div>
              ) : (
                <SignInButton mode="modal">
                  <Button
                    data-testid={AUTH_TESTIDS.SIGN_IN_BUTTON}
                    variant="default"
                    size="sm"
                  >
                    Sign In
                  </Button>
                </SignInButton>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="lg:hidden border-t px-4 py-3">
        <SearchBar />
      </div>
    </header>
  );
}
