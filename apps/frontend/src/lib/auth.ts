import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3030",
  apiPath: "/api/auth",
});

export const { signIn, signOut, useSession, getSession } = authClient;

// Custom signup function that calls our tRPC endpoint
export async function signUp({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name: string;
}) {
  try {
    // tRPC expects input to be wrapped in an object with 'json' key
    const response = await fetch("http://localhost:3030/trpc/auth.signUp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        json: {
          email,
          password,
          name,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errorMessage =
        data.error?.message || data.message || "Failed to create account";
      return { error: { message: errorMessage } };
    }

    return {
      user: data.result?.data?.json?.user,
      session: data.result?.data?.json?.session,
    };
  } catch (error: any) {
    return { error: { message: error.message || "Failed to create account" } };
  }
}

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  handle?: string;
  role?: string;
}

export interface AuthSession {
  user: AuthUser;
  session: {
    id: string;
    token: string;
    expiresAt: string;
  };
}
