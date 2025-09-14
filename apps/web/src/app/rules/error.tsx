"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default function RulesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Rules page error:", error);
  }, [error]);

  return (
    <div className="container py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mb-4 rounded-full bg-destructive/10 p-3 w-fit mx-auto">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Failed to load rules</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            We're having trouble loading the rules. This might be a temporary
            issue with our servers.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={reset} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button asChild variant="outline">
              <a href="/">
                <Search className="mr-2 h-4 w-4" />
                Go to search
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
