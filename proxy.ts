import { NextRequest, NextResponse } from "next/server";
import { JARVIS_SESSION_COOKIE, verifySessionToken } from "./lib/auth";

const publicPaths = new Set(["/unlock", "/api/auth/login", "/manifest.webmanifest"]);

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (publicPaths.has(path) || path.startsWith("/_next/") || path === "/favicon.ico") return NextResponse.next();

  const password = process.env.JARVIS_ACCESS_PASSWORD || "";
  const authorised = await verifySessionToken(request.cookies.get(JARVIS_SESSION_COOKIE)?.value, password);
  if (authorised) return NextResponse.next();

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: password ? "Unlock JARVIS to continue." : "JARVIS access is not configured." }, { status: password ? 401 : 503 });
  }

  const unlock = new URL("/unlock", request.url);
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
