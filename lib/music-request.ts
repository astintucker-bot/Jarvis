export type MusicRequest = { action: string; title?: string; artist?: string };
/** Only direct music commands are handled locally; ordinary questions remain chat. */
export function parseMusicRequest(message: string): MusicRequest | null {
  const text = message.trim().replace(/^jarvis[, :]+/i, "").replace(/^(?:please\s+|(?:can|could|would) you\s+)/i, "").replace(/^please\s+/i, "").replace(/[.!?]+$/, "").replace(/\s+please$/i, "").trim();
  if (/^(?:play|resume)(?: (?:my |the )?(?:apple )?music)?$/i.test(text)) return { action: "play" };
  if (/^pause(?: (?:my |the )?(?:apple )?music)?$/i.test(text)) return { action: "pause" };
  if (/^stop(?: (?:my |the )?(?:apple )?music)?$/i.test(text)) return { action: "stop" };
  if (/^(?:skip(?: (?:this |the )?(?:song|track))?|next(?: (?:song|track))?)$/i.test(text)) return { action: "next" };
  if (/^(?:(?:lower|decrease|turn down) (?:the )?(?:music(?: volume)?|volume)|(?:turn (?:the )?music down)|quieter)$/i.test(text)) return { action: "volume_down" };
  if (/^(?:(?:raise|increase|turn up) (?:the )?(?:music(?: volume)?|volume)|(?:turn (?:the )?music up)|louder)$/i.test(text)) return { action: "volume_up" };
  const song = text.match(/^play\s+(.+?)(?:\s+on apple music)?$/i);
  if (!song || /^(?:a game|chess|a role|devil.s advocate|a video|a movie|a podcast|the role)\b/i.test(song[1])) return null;
  const parts = song[1].split(/\s+by\s+/i);
  const title = parts[0].replace(/^["“]|["”]$/g, "").trim();
  const artist = parts.slice(1).join(" by ").trim();
  return title ? { action: "play_song", title, artist } : null;
}

export function musicReply(action: string, result: { error?: string; message?: string; ok?: boolean }): string {
  if (result.error) return result.error;
  if (!result.ok) return "Music did not confirm the command.";
  if (result.message) return result.message;
  return ({ play: "Music resumed.", pause: "Music paused.", stop: "Music stopped.", next: "Skipped to the next track.", volume_down: "Music volume lowered.", volume_up: "Music volume raised." } as Record<string, string>)[action] || "Music command completed.";
}
