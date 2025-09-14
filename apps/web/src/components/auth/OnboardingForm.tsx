"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/server-actions";
import type { AppUser } from "@/lib/auth-types";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";

interface OnboardingFormProps {
  user: AppUser;
}

export function OnboardingForm({ user }: OnboardingFormProps) {
  const [handle, setHandle] = useState(user.handle);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    startTransition(async () => {
      const result = await completeOnboarding(formData);

      if (result.success) {
        if (result.redirectTo) {
          router.push(result.redirectTo);
        }
      } else {
        setError(result.error || "Something went wrong");
      }
    });
  };

  return (
    <div className="bg-white px-6 py-8 shadow-lg rounded-lg border border-gray-200">
      <form action={handleSubmit} className="space-y-6">
        <div>
          <Label
            htmlFor="handle"
            className="block text-sm font-medium text-gray-700"
          >
            Choose your handle
          </Label>
          <div className="mt-1">
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                @
              </span>
              <Input
                type="text"
                name="handle"
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="rounded-l-none"
                placeholder="your-handle"
                required
                minLength={3}
                maxLength={30}
                pattern="^[a-z0-9-]+$"
                disabled={isPending}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Your handle will be used in your profile URL and must be unique.
              Use only lowercase letters, numbers, and hyphens.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
            disabled={isPending}
          >
            Skip for now
          </Button>

          <Button
            type="submit"
            disabled={isPending || !handle || handle.length < 3}
          >
            {isPending ? "Setting up..." : "Complete Setup"}
          </Button>
        </div>
      </form>
    </div>
  );
}
