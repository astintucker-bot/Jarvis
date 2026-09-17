import { NextRequest, NextResponse } from "next/server";
import { JARVIS_PROMPT } from "../../../lib/jarvisPrompt";
import { checkRateLimit, rateLimitResponse, requestIdentity } from "../../../lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 300;

type ChatMessage = { role: "user" | "assistant"; content: string };

function getOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (payload?.output || []).flatMap((item: any) => item?.content || [])
    .filter((part: any) => part?.type === "output_text")
    .map((part: any) => part?.text || "").join("\n").trim();
}

async function requestOpenAI(key: string, requestBody: Record<string, unknown>) {
  const send = () => fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  let response = await send();
  let payload = await response.json();
  const message = String(payload?.error?.message || "");
  if (!response.ok && /reasoning(?:\.effort)?[^.]*not supported|unsupported parameter[^.]*reasoning/i.test(message)) {
    delete requestBody.reasoning;
    response = await send();
    payload = await response.json();
  }
  return { response, payload };
}

export async function POST(request: NextRequest) {
  const limit = checkRateLimit("chat", requestIdentity(request), 60, 60 * 60 * 1_000);
  if (!limit.allowed) return rateLimitResponse(limit);
  if (Number(request.headers.get("content-length") || 0) > 100_000) return NextResponse.json({ error: "Conversation is too large. Start a new chat or shorten the request." }, { status: 413 });
  const body = await request.json().catch(() => ({})) as { message?: unknown; messages?: unknown };
  const legacyMessage = typeof body.message === "string" ? body.message.trim() : "";
  const messages: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : legacyMessage ? [{ role: "user", content: legacyMessage }] : [])
    .filter((item: any) => (item?.role === "user" || item?.role === "assistant") && typeof item?.content === "string")
    .slice(-24)
    .map((item: ChatMessage) => ({ role: item.role, content: item.content.trim().slice(0, 12_000) }))
    .filter((item: ChatMessage) => item.content);
  let totalCharacters = 0;
  const boundedMessages = messages.filter(item => { totalCharacters += item.content.length; return totalCharacters <= 80_000; });
  if (!boundedMessages.some(item => item.role === "user")) return NextResponse.json({ error: "Enter a message." }, { status: 400 });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Text chat is not configured. Add OPENAI_API_KEY to the server environment." }, { status: 503 });

  try {
    const { response: upstream, payload } = await requestOpenAI(key, {
      model: process.env.JARVIS_TEXT_MODEL || "gpt-6-astra",
      reasoning: { effort: process.env.JARVIS_REASONING_EFFORT || "high" },
      instructions: JARVIS_PROMPT,
      input: boundedMessages,
      tools: [{ type: "web_search" }],
      store: false,
    });
    const reply = getOutputText(payload);
    if (!upstream.ok || !reply) return NextResponse.json({ error: payload?.error?.message || "The AI service could not answer right now." }, { status: upstream.status || 502 });
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "The AI service is temporarily unavailable." }, { status: 503 });
  }
}
