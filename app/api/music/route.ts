import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { requireJarvisAccess } from "../../../lib/safetyPolicy";

export const runtime = "nodejs";
const run = promisify(execFile);
const scripts: Record<string, string> = {
  play: 'tell application "Music" to play',
  pause: 'tell application "Music" to pause',
  next: 'tell application "Music" to next track',
  volume_up: 'set currentVolume to output volume of (get volume settings)\nset volume output volume (min of 100 and (currentVolume + 10))',
  volume_down: 'set currentVolume to output volume of (get volume settings)\nset volume output volume (max of 0 and (currentVolume - 10))',
};

export async function POST(request: NextRequest) {
  const denied = requireJarvisAccess(request, { sideEffect: true });
  if (denied) return denied;
  const body = await request.json().catch(() => ({})) as { action?: string };
  const script = body.action ? scripts[body.action] : undefined;
  if (!script) return NextResponse.json({ error: "Unsupported music action." }, { status: 400 });
  try {
    await run("osascript", ["-e", script], { timeout: 5_000 });
    return NextResponse.json({ ok: true, action: body.action });
  } catch {
    return NextResponse.json({ error: "macOS could not control Apple Music. Open Music once, then allow your Terminal or Node process in System Settings > Privacy & Security > Automation." }, { status: 503 });
  }
}
