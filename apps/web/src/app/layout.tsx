import type { Metadata } from "next";
import { TRPCProvider } from "@/lib/trpc";
import { ThemeProvider } from "@/providers/theme-provider";
import { Header } from "@/components/shell/header";
import { Footer } from "@/components/shell/footer";
import { defaultMetadata } from "@/app-meta/seo";
import "./globals.css";

export const metadata: Metadata = defaultMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <TRPCProvider>
            <div className="relative flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
