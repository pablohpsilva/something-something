import { Suspense } from "react";
import { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";
import { createServerCaller } from "@/server/trpc";
import { DonationsClient } from "./donations-client";

export const metadata: Metadata = {
  title: "Donations Dashboard",
  description: "View your donation statistics and analytics",
};

async function DonationsData() {
  const trpc = await createServerCaller();

  try {
    const [stats, donations] = await Promise.all([
      trpc.donations.statsForAuthor({ windowDays: 30 }),
      trpc.donations.listMine({ type: "received", limit: 10 }),
    ]);

    return (
      <DonationsClient initialStats={stats} initialDonations={donations} />
    );
  } catch (error) {
    console.error("Failed to load donations data:", error);
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Donations Dashboard</h1>
          <p className="text-muted-foreground">
            Failed to load donation data. Please try again later.
          </p>
        </div>
      </div>
    );
  }
}

function DonationsLoading() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts/Tables */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DonationsPage() {
  return (
    <Suspense fallback={<DonationsLoading />}>
      <DonationsData />
    </Suspense>
  );
}
