"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Label } from "@repo/ui/components/label";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  User,
  FileText,
  MessageSquare,
  Shield,
  CheckCircle,
  XCircle,
} from "lucide-react";

const actionIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "rule.publish": FileText,
  "rule.deprecate": XCircle,
  "comment.delete": MessageSquare,
  "claim.approve": CheckCircle,
  "claim.reject": XCircle,
  "user.ban": Shield,
  "user.unban": CheckCircle,
};

const actionColors: Record<string, string> = {
  "rule.publish": "bg-green-100 text-green-800",
  "rule.deprecate": "bg-red-100 text-red-800",
  "comment.delete": "bg-orange-100 text-orange-800",
  "claim.approve": "bg-blue-100 text-blue-800",
  "claim.reject": "bg-red-100 text-red-800",
  "user.ban": "bg-red-100 text-red-800",
  "user.unban": "bg-green-100 text-green-800",
};

function formatActionName(action: string): string {
  const parts = action.split(".");
  if (parts.length !== 2) return action;

  const [resource, verb] = parts;
  return `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${resource}`;
}

export default function AdminAuditPage() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("all");

  const { data, isLoading } = api.admin.getAuditLogs.useQuery({
    action: actionFilter === "all" ? undefined : actionFilter,
    targetType: targetTypeFilter === "all" ? undefined : targetTypeFilter,
    limit: 50,
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-2 text-gray-600">
            Track all administrative actions and system events.
          </p>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const logs = data?.items || [];
  const uniqueActions = [...new Set(logs.map((log) => log.action))];
  const uniqueTargetTypes = [
    ...new Set(logs.map((log) => log.targetType).filter(Boolean)),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-2 text-gray-600">
          Track all administrative actions and system events for compliance and
          monitoring.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="actionFilter">Action Type</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatActionName(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="targetTypeFilter">Target Type</Label>
              <Select
                value={targetTypeFilter}
                onValueChange={setTargetTypeFilter}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTargetTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type?.charAt(0).toUpperCase() + type?.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No audit logs found
            </h3>
            <p className="text-gray-600 text-center">
              No logs match the current filters. Try adjusting your filter
              criteria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const ActionIcon = actionIcons[log.action] || Activity;
            const actionColor =
              actionColors[log.action] || "bg-gray-100 text-gray-800";

            return (
              <Card key={log.id}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`rounded-lg p-2 ${actionColor
                        .replace("text-", "bg-")
                        .replace("800", "50")}`}
                    >
                      <ActionIcon
                        className={`h-5 w-5 ${actionColor.split(" ")[1]}`}
                      />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {formatActionName(log.action)}
                        </h3>
                        <Badge className={actionColor}>{log.action}</Badge>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Actor:</span>{" "}
                          {log.actor
                            ? `${log.actor.displayName} (@${log.actor.handle})`
                            : "System"}
                        </p>

                        {log.targetId && (
                          <p>
                            <span className="font-medium">Target:</span>{" "}
                            {log.targetType} ({log.targetId})
                          </p>
                        )}

                        {log.reason && (
                          <p>
                            <span className="font-medium">Reason:</span>{" "}
                            {log.reason}
                          </p>
                        )}

                        <p>
                          <span className="font-medium">Time:</span>{" "}
                          {formatDistanceToNow(new Date(log.createdAt), {
                            addSuffix: true,
                          })}
                        </p>

                        {log.metadata &&
                          Object.keys(log.metadata).length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                                Additional Details
                              </summary>
                              <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}
                      </div>
                    </div>

                    <div className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
