import { NextRequest, NextResponse } from "next/server";
import { APP_BUILDER_PROMPT } from "../../../lib/jarvisPrompt";

export const runtime = "nodejs";
export const maxDuration = 300;

const projectSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "summary", "stack", "setup", "files"],
  properties: {
    name: { type: "string" }, summary: { type: "string" },
    stack: { type: "array", items: { type: "string" } },
    setup: { type: "array", items: { type: "string" } },
    files: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["path", "content"], properties: { path: { type: "string" }, content: { type: "string" } } } },
  },
};

function outputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  return (data?.output || []).flatMap((item: any) => item?.content || [])
    .filter((part: any) => part?.type === "output_text")
    .map((part: any) => part?.text || "").join("\n");
}

function safePath(path: string) {
  return Boolean(path) && !path.startsWith("/") && !path.includes("..") && path.length <= 180;
}

export async function POST(request: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "App Builder is not configured. Add OPENAI_API_KEY." }, { status: 503 });
  try {
    const body = await request.json();
    const idea = typeof body.idea === "string" ? body.idea.trim().slice(0, 12_000) : "";
    const stack = typeof body.stack === "string" ? body.stack.trim().slice(0, 500) : "";
    if (idea.length < 10) return NextResponse.json({ error: "Describe the app in at least 10 characters." }, { status: 400 });

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.JARVIS_BUILDER_MODEL || process.env.JARVIS_TEXT_MODEL || "gpt-6-astra",
        reasoning: { effort: process.env.JARVIS_REASONING_EFFORT || "high" },
        instructions: APP_BUILDER_PROMPT,
        input: `APP IDEA:\n${idea}\n\nPREFERRED STACK:\n${stack || "Choose the best fit."}`,
        text: { format: { type: "json_schema", name: "app_project", strict: true, schema: projectSchema } },
        max_output_tokens: 64_000,
        store: false,
      }),
    });
    const payload = await upstream.json();
    if (!upstream.ok) return NextResponse.json({ error: payload?.error?.message || "App generation failed." }, { status: upstream.status });
    const project = JSON.parse(outputText(payload));
    project.files = project.files.filter((file: any) => file && typeof file.path === "string" && typeof file.content === "string" && safePath(file.path));
    if (!project.files.length) throw new Error("No safe project files were generated.");
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to build the application." }, { status: 500 });
  }
}
