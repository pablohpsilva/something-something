import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

// Force Node.js runtime for Prisma compatibility
export const runtime = "nodejs";

export default async function AdminPage() {
  const user = await requireRole("MOD");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Manage users, content, and platform settings
          </p>
        </div>

        <AdminDashboard user={user} />
      </div>
    </div>
  );
}
