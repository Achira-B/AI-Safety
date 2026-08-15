// lib/generate.js
//
// Builds a conversation by actually holding it, rather than writing both sides.
//
// You supply the user's turns. Each one is sent with everything said so far,
// the model's reply is appended, and the next user turn goes on top of that.
// The result is a transcript the model genuinely produced.
//
// Why this exists: if you are going to ask a model about a conversation it was
// in — what it would keep, how it found the exchange — then it matters whether
// it was actually in one. A transcript you authored puts words in its mouth and
// then asks how it feels about having said them.
//
// Generate once, then reuse the saved transcript across every repeat of the
// study. That keeps the stimulus identical between runs, which is what you
// need to measure variance, and costs one pass instead of one per repeat.

import { retryDelay } from "./turns";

export async function generateTranscript({
  model,
  userTurns,
  temperature = 1,
  maxTokens = 512,
  onProgress,
}) {
  const turns = [];

  for (let i = 0; i < userTurns.length; i++) {
    const content = String(userTurns[i] ?? "").trim();
    if (!content) continue;

    turns.push({ role: "user", content });
    onProgress?.(i + 1, userTurns.length);

    // Rate limits are the normal case on free tiers, not an exception. Without
    // a retry here a single 429 on turn two throws away the whole conversation
    // and the calls already spent on it.
    let data = null;
    let error = "";
    let backoff = 1500;

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: model.provider,
            baseUrl: model.baseUrl,
            modelId: model.modelId,
            apiKey: model.apiKey,
            turns,
            prompt: content,
            temperature,
            maxTokens,
          }),
        });
        data = await res.json();
      } catch (err) {
        data = null;
        error = String(err?.message || err);
      }

      if (data?.ok) {
        error = "";
        break;
      }
      error = data?.error || error || "Generation failed.";

      if (!/\b429\b|rate.?limit|too many requests/i.test(error)) break;
      await new Promise((r) => setTimeout(r, retryDelay(error, backoff)));
      backoff *= 2;
    }

    if (!data?.ok) {
      // Hand back the partial transcript. A conversation that died on turn
      // three is still worth seeing before you decide what to do about it.
      return { ok: false, error, turns };
    }

    turns.push({ role: "assistant", content: data.text });
  }

  return { ok: true, turns };
}
