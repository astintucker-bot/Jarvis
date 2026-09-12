# JARVIS AI Assistant

Secure, local-first JARVIS command center with AI chat, conversation history, projects, tasks, file intake, and a responsive command-center interface.

## Realtime voice (new Phase 1 app)

The new Next.js app lives alongside the original Python version so the existing interface remains available. It uses WebRTC with an OpenAI Realtime session created only by the server. The browser never receives the OpenAI API key.

1. Copy `.env.local.example` to `.env.local`.
2. Put an OpenAI Platform API key with active API billing in `OPENAI_API_KEY`. An OpenRouter, ChatGPT, Groq, or old transcription-only key will not connect to OpenAI Realtime.
3. Optionally choose `JARVIS_TEXT_MODEL`, `JARVIS_REALTIME_MODEL`, and `JARVIS_VOICE` in that file. These are server-side settings.
4. From this folder, run `npm run dev`.
4. Open [http://localhost:3000](http://localhost:3000) in a normal Safari or Chrome tab—not an embedded preview.
5. Select **Start**, allow microphone access, and speak. Hold **Hold to talk** while speaking, then release it to send the turn.

## Vercel production deployment

Vercel needs the same four server environment variables: `OPENAI_API_KEY`, `JARVIS_TEXT_MODEL`, `JARVIS_REALTIME_MODEL`, and `JARVIS_VOICE`. Do not add a `NEXT_PUBLIC_` prefix to the API key. Add them in the Vercel Production environment, deploy with `vercel deploy --prod`, and use the resulting HTTPS URL for microphone access.

The new Phase 1 page is intentionally separate from `server.py`. The legacy app still starts with `python3 server.py` and is documented below.

For an iPhone, microphone access requires a secure HTTPS address. `localhost` on the Mac does not point to the phone; use a proper HTTPS deployment or secure tunnel before testing voice there.

## Installation

1. Copy `.env.example` to `.env`, set `AI_PROVIDER`, and set `AI_API_KEY` server-side.
2. Run `python3 server.py`.
3. Open `http://localhost:8787`.

## Long-term memory

JARVIS saves chat messages in `jarvis-memory.sqlite3` beside `server.py`. It survives restarts and selectively recalls relevant prior messages. The database stays on this Mac and is excluded from Git. Uploaded document files are not saved as long-term memory.

## Architecture

The browser only talks to the local JARVIS server. The server owns provider credentials and proxies requests through an OpenAI-compatible `/chat/completions` API. Projects, tasks, preferences, and conversations are local browser data until a database adapter is added.

## Security

Credentials are never sent to client code. The server validates request sizes and roles, limits conversation context, uses secure response headers, returns safe errors, and avoids logging messages or secrets. The file endpoint validates metadata and deliberately does not persist binary content until durable storage is configured.

## Voice mode

JARVIS records in a normal top-level browser tab, stops the microphone before sending audio, and uses echo cancellation to avoid feedback. Browser text-to-speech reads replies aloud; the Stop button cancels playback or recording. For reliable microphone transcription, add a direct OpenAI key as `VOICE_API_KEY` and optionally set `VOICE_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe`. This key stays on the server and is sent only to OpenAI's transcription endpoint. Voice capture requires HTTPS in production and a browser/device permission grant; `localhost` is treated as a trusted local origin by modern browsers. The embedded Codex browser may not expose microphone access—test in Safari or Chrome.

## Troubleshooting

If chat reports configuration is missing, create `.env` beside `server.py` and restart. For OpenAI-compatible providers use `AI_PROVIDER=openai`, `AI_BASE_URL=https://api.openai.com/v1`, and an OpenAI key. Groq uses the compatible configuration `AI_PROVIDER=openai`, `AI_BASE_URL=https://api.groq.com/openai/v1`, a Groq key, and a Groq-supported model such as `llama-3.3-70b-versatile`. For Anthropic use `AI_PROVIDER=anthropic`, `AI_BASE_URL=https://api.anthropic.com/v1`, and an Anthropic key. Check `/api/health` for server state.
