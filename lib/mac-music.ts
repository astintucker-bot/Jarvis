export async function controlMacMusic(action: string, title = "", artist = ""): Promise<{ ok?: boolean; error?: string; state?: string; message?: string }> {
  const token = window.sessionStorage.getItem("jarvis-music-pairing");
  if (!token) return { error: "Connect the Mac music helper in Music settings first." };
  try {
    const options: RequestInit & { targetAddressSpace: string } = {
      method: "POST", targetAddressSpace: "loopback", credentials: "omit",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, title, artist }), signal: AbortSignal.timeout(25000),
    };
    const response = await fetch("http://127.0.0.1:18765/music", options);
    const result = await response.json();
    if (!response.ok && action === "play_song" && result.error === "Unsupported music action.") return { error: "Restart the updated Mac music helper, then reconnect in Music settings to enable song requests." };
    if (!response.ok) return { error: result.error || "Music control failed." };
    return result;
  } catch {
    return { error: "Cannot reach the Mac music helper. Keep its Terminal window open, use Chrome on the same Mac, and allow local network access if prompted." };
  }
}
