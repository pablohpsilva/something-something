import { redirect } from "next/navigation";
import { getCurrentUserServer } from "@/lib/auth";
import { OnboardingForm } from "@/components/auth/OnboardingForm";

// Force Node.js runtime for Prisma compatibility
export const runtime = "nodejs";

export default async function OnboardingPage() {
  const user = await getCurrentUserServer();

  if (!user) {
    redirect("/sign-in");
  }

  // If user already has a custom handle (not auto-generated), redirect to home
  // Auto-generated handles typically end with numbers or have "user" in them
  const hasCustomHandle =
    !user.handle.includes("user") && !/\d+$/.test(user.handle);
  if (hasCustomHandle) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome to Core Directory Engine!
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Let's set up your profile to get started
          </p>
        </div>

        <div className="mt-8">
          <OnboardingForm user={user} />
        </div>
      </div>
    </div>
  );
}
