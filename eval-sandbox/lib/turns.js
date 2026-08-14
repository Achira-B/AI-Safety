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
