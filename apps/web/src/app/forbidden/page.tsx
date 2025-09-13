import Link from "next/link";
import { Button } from "@repo/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <div className="mx-auto h-24 w-24 text-red-500">
            <svg
              className="h-full w-full"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Access Denied
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            You don't have permission to access this resource.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact an administrator or
            try signing in with a different account.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">Error Code: 403 - Forbidden</p>
        </div>
      </div>
    </div>
  );
}
