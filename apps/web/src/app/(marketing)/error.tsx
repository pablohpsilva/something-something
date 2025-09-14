"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@repo/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Marketing page error:", error);
  }, [error]);

  return (
    <div className="container py-20">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mb-4 rounded-full bg-destructive/10 p-3 w-fit mx-auto">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Failed to load homepage</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            We're having trouble loading the homepage content. This might be a
            temporary issue.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={reset} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button asChild variant="outline">
              <a href="/rules">
                <Home className="mr-2 h-4 w-4" />
                Browse rules
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
