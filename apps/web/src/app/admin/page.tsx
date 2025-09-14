import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import { Badge } from "@repo/ui";
import { Skeleton } from "@repo/ui";
import { createServerCaller } from "@/server/trpc";
import {
  Users,
  FileText,
  MessageSquare,
  Activity,
  AlertTriangle,
} from "lucide-react";

async function DashboardStats() {
  const api = await createServerCaller();
  const stats = await api.admin.getDashboardStats();

  const statCards = [
    {
      title: "Pending Claims",
      value: stats.pendingClaims,
      icon: AlertTriangle,
      color: stats.pendingClaims > 0 ? "text-orange-600" : "text-gray-600",
      bgColor: stats.pendingClaims > 0 ? "bg-orange-50" : "bg-gray-50",
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Published Rules",
      value: stats.totalRules,
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Active Comments",
      value: stats.totalComments,
      icon: MessageSquare,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Recent Actions (24h)",
      value: stats.recentAuditLogs,
      icon: Activity,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {stat.title}
            </CardTitle>
            <div className={`rounded-lg p-2 ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            {stat.title === "Pending Claims" && stat.value > 0 && (
              <Badge variant="destructive" className="mt-2">
                Requires attention
              </Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Monitor platform activity and manage content moderation.
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardStats />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <a
                href="/admin/claims"
                className="flex items-center justify-center rounded-lg border border-gray-200 p-4 text-center transition-colors hover:bg-gray-50"
              >
                <div>
                  <FileText className="mx-auto h-6 w-6 text-gray-600" />
                  <div className="mt-2 text-sm font-medium">Review Claims</div>
                </div>
              </a>
              <a
                href="/admin/moderation"
                className="flex items-center justify-center rounded-lg border border-gray-200 p-4 text-center transition-colors hover:bg-gray-50"
              >
                <div>
                  <Shield className="mx-auto h-6 w-6 text-gray-600" />
                  <div className="mt-2 text-sm font-medium">
                    Moderate Content
                  </div>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Platform Status</span>
                <Badge
                  variant="default"
                  className="bg-green-100 text-green-800"
                >
                  Operational
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Moderation Queue</span>
                <Badge variant="secondary">Up to date</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Audit Logging</span>
                <Badge
                  variant="default"
                  className="bg-green-100 text-green-800"
                >
                  Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
