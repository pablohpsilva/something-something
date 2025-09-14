import { NextResponse } from "next/server";

export async function GET() {
  // Authentication has been removed from this application
  return NextResponse.json({ error: "Authentication has been removed" }, { status: 401 });
}