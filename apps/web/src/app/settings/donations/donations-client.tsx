"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  ExternalLink,
  Gift,
  BarChart3,
  Clock,
} from "lucide-react";
import { api } from "@/lib/trpc";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type {
  AuthorDonationStatsResponse,
  DonationListResponse,
} from "@repo/trpc/schemas/donations";

interface DonationsClientProps {
  initialStats: AuthorDonationStatsResponse;
  initialDonations: DonationListResponse;
}

export function DonationsClient({
  initialStats,
  initialDonations,
}: DonationsClientProps) {
  const [windowDays, setWindowDays] = useState(30);

  const { data: stats, isLoading: statsLoading } =
    api.donations.statsForAuthor.useQuery(
      { windowDays },
      { initialData: windowDays === 30 ? initialStats : undefined }
    );

  const { data: donations } = api.donations.listMine.useQuery(
    { type: "received", limit: 10 },
    { initialData: initialDonations }
  );

  const formatAmount = (cents: number, currency = "USD") => {
    return formatCurrency(cents / 100, currency);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SUCCEEDED":
        return "bg-green-100 text-green-800";
      case "INIT":
        return "bg-yellow-100 text-yellow-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Donations Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track your donations and supporter engagement
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={windowDays.toString()}
            onValueChange={(value) => setWindowDays(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="donations-kpi-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total All-Time
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(stats?.totalCentsAllTime || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Lifetime donations received
            </p>
          </CardContent>
        </Card>

        <Card data-testid="donations-kpi-30d">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Last {windowDays} Days
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(stats?.totalCentsWindow || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Recent donations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Supporters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.recentDonors?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Recent supporters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Donations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.countWindow || 0}</div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Rules */}
        <Card data-testid="donations-toprules-table">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Rules by Donations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topRules && stats.topRules.length > 0 ? (
              <div className="space-y-3">
                {stats.topRules.map((rule, index) => (
                  <div
                    key={rule.ruleId}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p
                          className="font-medium truncate max-w-48"
                          title={rule.title}
                        >
                          {rule.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {rule.count} donation{rule.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatAmount(rule.totalCents)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        asChild
                      >
                        <a
                          href={`/rules/${rule.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rule-specific donations yet</p>
                <p className="text-sm">
                  Donations will appear here when supporters tip specific rules
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Day */}
        <Card data-testid="donations-byday-table">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Daily Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.byDay && stats.byDay.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {stats.byDay.slice(0, 14).map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="text-sm">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {day.count} donation{day.count !== 1 ? "s" : ""}
                      </span>
                      <span className="font-medium min-w-16 text-right">
                        {formatAmount(day.cents)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No donations in this period</p>
                <p className="text-sm">Daily breakdown will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Supporters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recent Supporters
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentDonors && stats.recentDonors.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stats.recentDonors.map((donor) => (
                <div
                  key={donor.id}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={donor.avatarUrl || undefined}
                      alt={donor.displayName}
                    />
                    <AvatarFallback>
                      {donor.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{donor.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      @{donor.handle}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold">
                        {formatAmount(donor.totalCents)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(donor.lastDonationAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No supporters yet</p>
              <p className="text-sm">
                Your supporters will appear here when they make donations
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Donations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Donations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {donations?.donations && donations.donations.length > 0 ? (
            <div className="space-y-4">
              {donations.donations.map((donation) => (
                <div
                  key={donation.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={donation.from?.avatarUrl || undefined}
                        alt={donation.from?.displayName || "Anonymous"}
                      />
                      <AvatarFallback>
                        {donation.from?.displayName?.charAt(0).toUpperCase() ||
                          "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {donation.from?.displayName || "Anonymous"}
                      </p>
                      {donation.rule && (
                        <p className="text-sm text-muted-foreground">
                          for "{donation.rule.title}"
                        </p>
                      )}
                      {donation.message && (
                        <p className="text-sm text-muted-foreground italic mt-1">
                          "{donation.message}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatAmount(donation.amountCents, donation.currency)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(donation.status)}>
                        {donation.status.toLowerCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(donation.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No donations received yet</p>
              <p className="text-sm">Your donation history will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase 2: Payout Status (stubbed) */}
      <Card data-testid="payout-status">
        <CardHeader>
          <CardTitle>Payout Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium mb-2">Direct payouts coming soon</p>
            <p className="text-sm">
              We're working on Stripe Connect integration to enable direct
              payouts to your bank account. For now, donations are held in the
              platform account.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
