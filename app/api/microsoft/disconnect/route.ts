import { NextResponse } from "next/server";
import { clearMicrosoftSession } from "../../../../lib/microsoftGraph";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ connected: false });
  clearMicrosoftSession(response);
  return response;
}
