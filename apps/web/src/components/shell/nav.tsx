"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_TESTIDS } from "@/lib/testids";
import { createLinkProps } from "@/lib/a11y";

const navItems = [
  {
    label: "Rules",
    href: "/rules",
    testId: NAV_TESTIDS.LINK_RULES,
  },
  {
    label: "Submit",
    href: "/submit",
    testId: NAV_TESTIDS.LINK_SUBMIT,
    authRequired: true,
  },
  {
    label: "Leaderboards",
    href: "/leaderboards",
    testId: NAV_TESTIDS.LINK_LEADERBOARDS,
  },
  {
    label: "Authors",
    href: "/authors",
    testId: NAV_TESTIDS.LINK_AUTHORS,
  },
];

interface NavProps {
  className?: string;
  isAuthenticated?: boolean;
  orientation?: "horizontal" | "vertical";
}

export function Nav({
  className = "",
  isAuthenticated = false,
  orientation = "horizontal",
}: NavProps) {
  const pathname = usePathname();

  const filteredItems = navItems.filter(
    (item) => !item.authRequired || isAuthenticated
  );

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const baseClasses =
    orientation === "horizontal"
      ? "flex items-center space-x-6"
      : "flex flex-col space-y-2";

  return (
    <nav
      className={cn(baseClasses, className)}
      role="navigation"
      aria-label="Main navigation"
    >
      {filteredItems.map((item) => {
        const linkProps = createLinkProps(
          `Navigate to ${item.label}`,
          item.testId,
          item.href
        );

        return (
          <Link
            key={item.href}
            {...linkProps}
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              isActive(item.href) ? "text-foreground" : "text-muted-foreground",
              orientation === "vertical" &&
                "py-2 px-3 rounded-md hover:bg-accent"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
