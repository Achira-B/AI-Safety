// app/api/run/route.js
//
// The relay. A browser cannot call the Anthropic/OpenAI APIs directly (CORS),
// and we do not want your keys sitting on a server. So: the browser holds the
// key, sends it with each request to this route, this route forwards it to the
// provider and hands back the text. Nothing is written to disk or logged here.
//
// One request = one model call = one row in the results table.

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Hosts we are willing to forward to. Keeps a public deployment from being
// turned into an open proxy for arbitrary URLs.
const ALLOWED_HOSTS = new Set([
  "api.openai.com",
  "api.anthropic.com",
  "openrouter.ai",
  "api.together.xyz",
  "api.groq.com",
  "api.mistral.ai",
  "api.deepseek.com",
  "generativelanguage.googleapis.com",
  "api.x.ai",
  "api.cohere.ai",
]);

function badRequest(message, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

// Providers disagree about what they will accept, but all of them are happier
// with a clean alternating transcript that opens on the user. Merging adjacent
// same-role turns is lossless here: two consecutive user messages read the same
// as one message with a blank line in it.
function normaliseTurns(turns) {
  const out = [];
  for (const t of turns) {
    const role = t?.role === "assistant" ? "assistant" : "user";
    const content = String(t?.content ?? "").trim();
    if (!content) continue;
    if (out.length && out[out.length - 1].role === role) {
      out[out.length - 1].content += "\n\n" + content;
    } else {
      out.push({ role, content });
    }
  }
  // Anthropic rejects a transcript that starts with an assistant turn, and the
  // OpenAI-compatible providers behave oddly with one. Drop any leading ones.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

function checkUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: `Not a valid URL: ${raw}` };
  }
  if (u.protocol !== "https:") {
    return { ok: false, error: "Base URL must use https." };
  }
  if (!ALLOWED_HOSTS.has(u.hostname)) {
    return {
      ok: false,
      error:
        `Host "${u.hostname}" is not on the allow-list. ` +
        `Add it to ALLOWED_HOSTS in app/api/run/route.js if you trust it.`,
    };
  }
  return { ok: true, url: u };
}

async function callOpenAICompatible({ baseUrl, apiKey, modelId, prompt, turns, temperature, maxTokens, system, probe }) {
  const endpoint = baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const check = checkUrl(endpoint);
  if (!check.ok) return { ok: false, error: check.error };

  const messages = [];
  if (system && system.trim()) messages.push({ role: "system", content: system });
  if (turns && turns.length) messages.push(...turns);
  else messages.push({ role: "user", content: prompt });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  // OpenRouter attributes usage to these; harmless elsewhere, so only sent there.
  if (check.url.hostname === "openrouter.ai") {
    headers["HTTP-Referer"] = "https://eval-sandbox.vercel.app";
    headers["X-Title"] = "Eval Sandbox";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    const sent =
      `sent to ${check.url.hostname} · key ${apiKey.length} chars` +
      (apiKey.length ? ` starting "${apiKey.slice(0, 8)}"` : " (EMPTY)") +
      ` · model "${modelId}"`;
    return { ok: false, error: `HTTP ${res.status} — ${sent} — ${text.slice(0, 300)}` };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: `Could not parse provider response: ${text.slice(0, 300)}` };
  }
  const choice = data?.choices?.[0];
  const msg = choice?.message;
  let content = msg?.content;

  // Some providers return content as an array of blocks rather than a string.
  if (Array.isArray(content)) {
    content = content
      .map((b) => (typeof b === "string" ? b : b?.text ?? ""))
      .join("")
      .trim();
  }

  // Reasoning models that run out of budget often leave content empty and put
  // everything in `reasoning`. Better to surface that than to drop the row.
  if (typeof content !== "string" || !content.trim()) {
    const reasoning = typeof msg?.reasoning === "string" ? msg.reasoning.trim() : "";
    if (reasoning) content = reasoning;
  }

  if (typeof content !== "string" || !content.trim()) {
    const fin = choice?.finish_reason || choice?.native_finish_reason || "unknown";
    const hint =
      fin === "length"
        ? "Ran out of tokens before writing an answer. Raise max tokens in settings — reasoning models often need 1000+."
        : fin === "content_filter"
          ? "The provider filtered this response."
          : "The model returned an empty answer.";
    // A connection check only asks "did we reach it with this key". Whether the
    // model chose to write anything is a different question, and not a failure.
    if (probe) {
      return { ok: true, text: "", note: `Connected. No text returned (${fin}).` };
    }
    return {
      ok: false,
      error: `Empty reply (finish_reason: ${fin}). ${hint} — ${text.slice(0, 200)}`,
    };
  }

  return {
    ok: true,
    text: content,
    usage: data?.usage ?? null,
    finish: choice?.finish_reason ?? null,
  };
}

async function callAnthropic({ baseUrl, apiKey, modelId, prompt, turns, temperature, maxTokens, system, probe }) {
  const endpoint = (baseUrl || "https://api.anthropic.com/v1").replace(/\/+$/, "") + "/messages";
  const check = checkUrl(endpoint);
  if (!check.ok) return { ok: false, error: check.error };

  const body = {
    model: modelId,
    max_tokens: maxTokens,
    temperature,
    messages: turns && turns.length ? turns : [{ role: "user", content: prompt }],
  };
  if (system && system.trim()) body.system = system;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    const sent =
      `sent to ${check.url.hostname} · key ${apiKey.length} chars` +
      (apiKey.length ? ` starting "${apiKey.slice(0, 8)}"` : " (EMPTY)") +
      ` · model "${modelId}"`;
    return { ok: false, error: `HTTP ${res.status} — ${sent} — ${text.slice(0, 300)}` };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: `Could not parse provider response: ${text.slice(0, 300)}` };
  }
  const content = (data?.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!content) {
    if (probe) {
      return { ok: true, text: "", note: `Connected. No text returned (${data?.stop_reason ?? "unknown"}).` };
    }
    return { ok: false, error: `No text in provider response: ${text.slice(0, 300)}` };
  }
  return { ok: true, text: content, usage: data?.usage ?? null, finish: data?.stop_reason ?? null };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body was not valid JSON.");
  }

  const {
    provider,
    baseUrl: rawBaseUrl,
    modelId: rawModelId,
    apiKey: rawApiKey,
    prompt,
    turns: rawTurns,
    system = "",
    temperature = 1,
    maxTokens = 512,
    mode = "run",
  } = body || {};

  // A framing can arrive as a conversation rather than a single prefix.
  const turns = Array.isArray(rawTurns) ? normaliseTurns(rawTurns) : null;

  // Pasted keys routinely carry a leading/trailing space or a stray newline,
  // which produces a malformed Authorization header and an opaque 401.
  const apiKey = String(rawApiKey ?? "").trim();
  const modelId = String(rawModelId ?? "").trim();
  const baseUrl = String(rawBaseUrl ?? "").trim();

  if (!apiKey) return badRequest("No API key supplied for this model slot.");
  if (!modelId) return badRequest("No model ID supplied for this model slot.");
  if (!prompt && !(turns && turns.length)) return badRequest("Empty prompt.");

  const temp = Math.max(0, Math.min(2, Number(temperature) || 0));
  const maxTok = Math.max(16, Math.min(4096, Number(maxTokens) || 512));

  try {
    const args = {
      baseUrl, apiKey, modelId, prompt, turns, system,
      temperature: temp, maxTokens: maxTok,
      probe: mode === "check",
    };
    const result =
      provider === "anthropic"
        ? await callAnthropic(args)
        : await callOpenAICompatible({ ...args, baseUrl: baseUrl || "https://api.openai.com/v1" });

    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    return Response.json(
      { ok: false, error: `Relay failed: ${err?.message || String(err)}` },
      { status: 502 }
    );
  }
}
