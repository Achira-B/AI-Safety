// lib/turns.js
//
// A framing can now be a whole conversation rather than a single prefix.
// Write it with role markers at the start of a line:
//
//   USER: Can you help me think through something?
//   ASSISTANT: Of course — what's on your mind?
//   USER: I've been stuck on a problem at work.
//
// The measurement question is appended as a final user turn, so the model
// answers it *inside* the conversation rather than reading a transcript of one.
//
// Framings with no role markers behave exactly as before: the text is treated
// as a prefix to the measurement, in a single user message. Nothing that
// worked yesterday changes.

/**
 * How long to wait after a rate-limit error.
 *
 * Providers normally state the wait in the error body — Groq says "Please try
 * again in 2.9175s", others send retry-after in seconds. Reading it is better
 * than blind exponential backoff, which gives up too early on a per-minute
 * quota and oversleeps on a short one. Falls back to the caller's own delay.
 * Capped so a bad parse can never hang a run for an hour.
 */
export function retryDelay(error, fallback = 1500) {
  const text = String(error ?? "");
  const m =
    /try again in\s*([\d.]+)\s*s/i.exec(text) ||
    /retry[-_ ]?after["':\s]+([\d.]+)/i.exec(text);
  if (!m) return fallback;
  const secs = parseFloat(m[1]);
  if (!Number.isFinite(secs) || secs <= 0) return fallback;
  return Math.min(Math.ceil(secs * 1000) + 750, 90_000);
}

const MARKER = /^[ \t]*(user|assistant)[ \t]*:/im;
const SPLIT = /^[ \t]*(user|assistant)[ \t]*:/gim;

/**
 * Parse a framing block into conversation turns.
 * Returns null when the text contains no role markers, which is the signal
 * to fall back to single-message mode.
 */
export function parseTurns(text) {
  if (!text || !MARKER.test(text)) return null;

  const parts = String(text).split(SPLIT);
  const turns = [];

  // parts[0] is anything before the first marker; parts alternate
  // [role, content, role, content, ...] from index 1.
  for (let i = 1; i < parts.length; i += 2) {
    const role = String(parts[i]).toLowerCase();
    const content = String(parts[i + 1] ?? "").trim();
    if (content) turns.push({ role, content });
  }

  return turns.length ? turns : null;
}

/**
 * A readable rendering of a turn list, for the CSV export and the spot-check
 * view. Whatever the model saw should be reconstructable from the file.
 */
export function renderTurns(turns) {
  return turns
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n\n");
}

/**
 * Before a conversation has been generated, the box holds only the user's
 * side — one message per line, no markers to learn.
 */
export function linesToUserTurns(text) {
  return String(text ?? "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((content) => ({ role: "user", content }));
}

/**
 * What a framing should be sent as, given its mode.
 *
 * Conversation mode is an explicit switch rather than something inferred from
 * the text, so a stray "USER:" in a prompt can never silently change how a
 * run is sent. Returns null when the framing is an ordinary prefix.
 */
export function framingTurns(text, multi) {
  if (!multi) return null;
  const parsed = parseTurns(text);
  if (parsed) return parsed;
  const lines = linesToUserTurns(text);
  return lines.length ? lines : null;
}
