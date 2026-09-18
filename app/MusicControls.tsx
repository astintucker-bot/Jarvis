"use client";
import { useState } from "react";
import { controlMacMusic } from "../lib/mac-music";

export function MusicControls() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Start the Mac helper, paste its pairing code, then connect.");
  const [busy, setBusy] = useState(false);
  async function run(action: string) {
    setBusy(true);
    try {
      if (action === "status" && code.trim()) window.sessionStorage.setItem("jarvis-music-pairing", code.trim());
      const result = await controlMacMusic(action);
      setMessage(result.error || (action === "status" ? `Connected to Music (${result.state || "ready"}).` : "Music command sent."));
      if (result.ok) setCode("");
    } catch { setMessage("Browser storage is unavailable. Allow storage for Jarvis, then retry."); }
    finally { setBusy(false); }
  }
  return <section className="edit-panel" aria-label="Apple Music controls">
    <h2>Apple Music on this Mac</h2>
    <p>Keep the Mac helper open. Pairing lasts for this browser tab. Volume controls change Music only.</p>
    <input type="password" aria-label="Mac helper pairing code" placeholder="Paste helper pairing code" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} />
    <button disabled={busy} onClick={() => void run("status")}>CONNECT / CHECK</button>
    <div>{[["play", "PLAY"], ["pause", "PAUSE"], ["next", "SKIP"], ["volume_down", "QUIETER"], ["volume_up", "LOUDER"]].map(([action, label]) => <button key={action} disabled={busy} onClick={() => void run(action)}>{label}</button>)}</div>
    <button disabled={busy} onClick={() => { window.sessionStorage.removeItem("jarvis-music-pairing"); setCode(""); setMessage("Disconnected in this tab."); }}>DISCONNECT</button>
    <p role="status">{busy ? "Contacting Music…" : message}</p>
  </section>;
}
