"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/lib/server-actions";
import type { AppUser } from "@/lib/auth-types";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Badge } from "@repo/ui/badge";

interface ProfileFormProps {
  user: AppUser;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || "");
  const [handle, setHandle] = useState(user.handle);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await updateProfile(formData);

      if (result.success) {
        setSuccess("Profile updated successfully!");
        if (result.user) {
          setDisplayName(result.user.displayName);
          setBio(result.user.bio || "");
          setHandle(result.user.handle);
        }
      } else {
        setError(result.error || "Something went wrong");
      }
    });
  };

  const hasChanges =
    displayName !== user.displayName ||
    bio !== (user.bio || "") ||
    handle !== user.handle;

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Avatar Section */}
      <div className="flex items-center space-x-6">
        <div className="shrink-0">
          {user.avatarUrl ? (
            <img
              className="h-16 w-16 rounded-full object-cover"
              src={user.avatarUrl}
              alt={user.displayName}
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-xl font-medium text-gray-700">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Profile Picture</p>
          <p className="text-sm text-gray-500">
            Managed through your account settings
          </p>
        </div>
      </div>

      {/* Display Name */}
      <div>
        <Label
          htmlFor="displayName"
          className="block text-sm font-medium text-gray-700"
        >
          Display Name
        </Label>
        <div className="mt-1">
          <Input
            type="text"
            name="displayName"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            required
            maxLength={100}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Handle */}
      <div>
        <Label
          htmlFor="handle"
          className="block text-sm font-medium text-gray-700"
        >
          Handle
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
            Your handle is used in your profile URL and must be unique.
          </p>
        </div>
      </div>

      {/* Bio */}
      <div>
        <Label
          htmlFor="bio"
          className="block text-sm font-medium text-gray-700"
        >
          Bio
        </Label>
        <div className="mt-1">
          <textarea
            name="bio"
            id="bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Tell us about yourself..."
            maxLength={500}
            disabled={isPending}
          />
          <p className="mt-2 text-sm text-gray-500">
            {bio.length}/500 characters
          </p>
        </div>
      </div>

      {/* Role Badge */}
      <div>
        <Label className="block text-sm font-medium text-gray-700">Role</Label>
        <div className="mt-1">
          <Badge
            variant={
              user.role === "ADMIN"
                ? "destructive"
                : user.role === "MOD"
                ? "default"
                : "secondary"
            }
          >
            {user.role}
          </Badge>
          <p className="mt-2 text-sm text-gray-500">
            Your role determines your permissions within the platform.
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !hasChanges}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
