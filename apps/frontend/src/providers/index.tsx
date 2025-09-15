"use client";

import { TRPCReactProvider } from "./trpc-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <TRPCReactProvider>{children}</TRPCReactProvider>;
}
