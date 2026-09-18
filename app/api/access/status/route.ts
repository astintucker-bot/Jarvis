import { NextRequest, NextResponse } from "next/server";
import { isAccessAuthorized, isAccessConfigured } from "../../../../lib/accessAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const required = isAccessConfigured();
  return NextResponse.json({ required, authenticated: !required || isAccessAuthorized(request) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
