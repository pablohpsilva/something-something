"use client";

import { TRPCProvider, createTRPCClientInstance } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Create a new QueryClient instance for SSR
 * Each request should have its own QueryClient to avoid sharing cache
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000, // 1 minute
        gcTime: 1000 * 60 * 10, // 10 minutes
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

/**
 * Get QueryClient instance - creates new for SSR, reuses for client
 */
function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new query client if we don't already have one
  // This is very important, so we don't re-make a new client if React
  // suspends during the initial render. This may not be needed if we
  // have a suspense boundary BELOW the creation of the query client
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

interface TRPCReactProviderProps {
  children: React.ReactNode;
}

/**
 * tRPC Provider component that handles both QueryClient and tRPC client setup
 * This follows the SSR-friendly pattern from tRPC documentation
 */
export function TRPCReactProvider({ children }: TRPCReactProviderProps) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => createTRPCClientInstance());

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
