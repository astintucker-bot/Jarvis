import { NextResponse } from "next/server";
import { clearGoogleSession } from "../../../../lib/googleCalendar";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ disconnected: true });
  clearGoogleSession(response);
  return response;
}
