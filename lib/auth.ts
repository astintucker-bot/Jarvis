export const JARVIS_SESSION_COOKIE = "jarvis_owner_session";
export const JARVIS_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

async function sessionDigest(password: string) {
  const material = encoder.encode(`jarvis-owner-session-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function createSessionToken(password: string) {
  return sessionDigest(password);
}

export async function verifySessionToken(token: string | undefined, password: string) {
  if (!token || !password) return false;
  return constantTimeEqual(token, await sessionDigest(password));
}

export async function verifyPassword(candidate: string, password: string) {
  if (!candidate || !password) return false;
  const [candidateDigest, passwordDigest] = await Promise.all([sessionDigest(candidate), sessionDigest(password)]);
  return constantTimeEqual(candidateDigest, passwordDigest);
}
