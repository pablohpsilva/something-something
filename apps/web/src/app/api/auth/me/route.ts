import { NextResponse } from "next/server";
import { getCurrentUserServer } from "@/lib/auth";

// Force Node.js runtime for Prisma compatibility
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUserServer();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching current user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
