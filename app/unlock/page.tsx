"use client";

import { FormEvent, useState } from "react";

export default function UnlockPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (!password || loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "JARVIS could not be unlocked.");
      window.location.replace("/");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "JARVIS could not be unlocked.");
    } finally { setLoading(false); }
  }

  return <main className="unlock-shell">
    <section className="unlock-card">
      <div className="unlock-orb">J</div>
      <small>OWNER ACCESS</small>
      <h1>JARVIS</h1>
      <p>Enter your private password to establish a secure session.</p>
      <form onSubmit={unlock}>
        <label htmlFor="jarvis-password">PRIVATE PASSWORD</label>
        <input id="jarvis-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} autoFocus required />
        <button disabled={!password || loading}>{loading ? "VERIFYING…" : "UNLOCK JARVIS"}</button>
      </form>
      {error && <strong role="alert">{error}</strong>}
    </section>
  </main>;
}
