import { NextRequest, NextResponse } from "next/server";
import { exchangeMicrosoftCode, MICROSOFT_STATE_COOKIE, MICROSOFT_VERIFIER_COOKIE, setMicrosoftSession } from "../../../../lib/microsoftGraph";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error_description");
  const savedState = request.cookies.get(MICROSOFT_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(MICROSOFT_VERIFIER_COOKIE)?.value;
  if (error || !code || !state || !savedState || state !== savedState || !verifier) {
    const message = error || "Microsoft authorization could not be verified.";
    return NextResponse.redirect(new URL(`/?word_error=${encodeURIComponent(message)}`, request.url));
  }
  try {
    const session = await exchangeMicrosoftCode(request, code, verifier);
    const response = NextResponse.redirect(new URL("/?word_connected=1", request.url));
    setMicrosoftSession(response, session);
    const expired = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 0 };
    response.cookies.set(MICROSOFT_STATE_COOKIE, "", expired);
    response.cookies.set(MICROSOFT_VERIFIER_COOKIE, "", expired);
    return response;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Microsoft authorization failed.";
    return NextResponse.redirect(new URL(`/?word_error=${encodeURIComponent(message)}`, request.url));
  }
}
