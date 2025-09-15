"use client";

import { useTRPC } from "@/lib/trpc";

/**
 * Example component showing how to use tRPC with React Query
 * This demonstrates the pattern but doesn't make actual API calls yet
 */
export function TRPCExample() {
  // Get the tRPC client instance
  const trpc = useTRPC();

  // Example of how you would use tRPC queries (commented out since no API endpoint exists yet)
  /*
  const userQuery = useQuery(trpc.auth.getProfile.queryOptions());
  const rulesQuery = useQuery(trpc.rules.list.queryOptions({
    limit: 10,
    cursor: undefined
  }));
  
  const createRuleMutation = useMutation(trpc.rules.create.mutationOptions());
  */

  return (
    <div className="p-6 border rounded-lg bg-gray-50 dark:bg-gray-900">
      <h3 className="text-lg font-semibold mb-4">tRPC Integration Ready</h3>
      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <p>✅ tRPC client configured with React Query</p>
        <p>✅ Type-safe AppRouter imported from @repo/trpc</p>
        <p>✅ SSR-friendly QueryClient setup</p>
        <p>✅ Superjson transformer configured</p>
        <p>🚀 Ready to make API calls to your tRPC backend</p>
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
        <p className="font-medium text-blue-800 dark:text-blue-200">Usage Example:</p>
        <pre className="mt-1 text-blue-700 dark:text-blue-300">
          {`const trpc = useTRPC();
const data = useQuery(
  trpc.rules.list.queryOptions({ limit: 10 })
);`}
        </pre>
      </div>
    </div>
  );
}
