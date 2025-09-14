"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import Link from "next/link";

export default function RuleDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Rule detail error:", error);
  }, [error]);

  return (
    <div className="container py-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mb-4 rounded-full bg-destructive/10 p-3 w-fit mx-auto">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Failed to load rule</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              We're having trouble loading this rule. It might be temporarily
              unavailable or you may not have permission to view it.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={reset} variant="default">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
              <Button asChild variant="outline">
                <Link href="/rules">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to rules
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
