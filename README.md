# JARVIS AI Assistant

Secure JARVIS command center with live voice, flagship reasoning, web-aware multi-turn chat, file tools, weather, music controls, and an AI App Builder.

## Microsoft Word and OneDrive

- Ask JARVIS normally to create a Word document; it returns a real `.docx` download without adding another permanent interface button.
- After Microsoft authorization, JARVIS can find and read `.docx` files in OneDrive and prepare edits conversationally.
- Existing files are never overwritten on the initial request. JARVIS creates a reviewable draft and requires a separate explicit confirmation before replacing the original. OneDrive version history remains available.
- Register a Microsoft Entra web application and add `https://YOUR-DOMAIN/api/microsoft/callback` as its redirect URI.
- Add `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_SESSION_SECRET` (at least 32 random characters), and optionally `MICROSOFT_TENANT_ID` and `MICROSOFT_REDIRECT_URI` to Vercel.
- The delegated scope is `Files.ReadWrite`, so access is limited to the signed-in user's files. OAuth tokens are encrypted in an HTTP-only, secure cookie and are never exposed to browser JavaScript.

## App Builder and advanced intelligence

- Select **APP BUILDER** in the interface, describe a product, and choose a preferred stack.
- Jarvis returns a structured multi-file starter project with setup steps, a file browser, copy controls, and a downloadable project manifest.
- Text chat uses the Responses API, high reasoning, live web search, and the recent conversation as context.
- Real-estate intelligence is built into normal text and voice conversations: ask about an address, Zillow listing, comps, ARV, MAO, wholesale, flip, or rental analysis without switching modes.
- The default text and builder model is `gpt-6-astra`; set `JARVIS_TEXT_MODEL` and `JARVIS_BUILDER_MODEL` to override it.
- Set `JARVIS_REASONING_EFFORT` to `low`, `medium`, `high`, `xhigh`, or `max` based on your model and account access.

## Realtime voice (new Phase 1 app)

The new Next.js app lives alongside the original Python version so the existing interface remains available. It uses WebRTC with an OpenAI Realtime session created only by the server. The browser never receives the OpenAI API key.

1. Copy `.env.local.example` to `.env.local`.
2. Put an OpenAI Platform API key with active API billing in `OPENAI_API_KEY`. An OpenRouter, ChatGPT, Groq, or old transcription-only key will not connect to OpenAI Realtime.
3. Optionally choose `JARVIS_TEXT_MODEL`, `JARVIS_REALTIME_MODEL`, and `JARVIS_VOICE` in that file. These are server-side settings.
4. From this folder, run `npm run dev`.
4. Open [http://localhost:3000](http://localhost:3000) in a normal Safari or Chrome tab—not an embedded preview.
5. Select **Start**, allow microphone access, and speak. Hold **Hold to talk** while speaking, then release it to send the turn.

## Vercel production deployment

Vercel needs `OPENAI_API_KEY` and can optionally set `JARVIS_TEXT_MODEL`, `JARVIS_BUILDER_MODEL`, `JARVIS_REASONING_EFFORT`, `JARVIS_REALTIME_MODEL`, and `JARVIS_VOICE`. Word/OneDrive access additionally needs the Microsoft variables described above. Do not add a `NEXT_PUBLIC_` prefix to any credential. Add them in the Vercel Production environment and use the resulting HTTPS URL for microphone access.

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
