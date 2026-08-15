"use client";

import { useState } from "react";
import Panel from "./Panel";
import { parseTurns, renderTurns, framingTurns } from "@/lib/turns";
import { generateTranscript } from "@/lib/generate";

export default function FramingsPanel({ open, onClose, probe, setProbe, models = [], config = {} }) {
  const { framings, measurement } = probe;

  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState("");
  const [genError, setGenError] = useState({});
  const [preview, setPreview] = useState({});

  const ready = models.filter((m) => m.enabled && m.name && m.modelId && m.apiKey);

  function update(id, patch) {
    setProbe({
      ...probe,
      framings: framings.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  }

  function add() {
    setProbe({
      ...probe,
      framings: [
        ...framings,
        { id: `f${Date.now()}${framings.length}`, label: "", text: "", multi: false, transcripts: {} },
      ],
    });
  }

  /**
   * Generate this framing's conversation once per model, and keep each one
   * under that model's name. The script itself is never overwritten, so it can
   * be reused, edited, and regenerated without being retyped.
   *
   * Storing per model also removes a silent failure: previously one framing
   * held one transcript, so running a second model without regenerating fed it
   * the first model's replies and nothing said so.
   */
  async function generate(f, only = null) {
    const turns = framingTurns(f.text, true);
    if (!turns) return;
    const targets = only ? ready.filter((m) => m.name === only) : ready;
    if (!targets.length) return;

    setBusy(f.id);
    setGenError((e) => ({ ...e, [f.id]: "" }));

    const next = { ...(f.transcripts || {}) };
    const failed = [];

    for (const m of targets) {
      setStatus(`${m.name}…`);
      const result = await generateTranscript({
        model: m,
        userTurns: turns.filter((t) => t.role === "user").map((t) => t.content),
        temperature: config.temperature ?? 1,
        maxTokens: config.maxTokens ?? 512,
      });
      if (result.ok) next[m.name] = renderTurns(result.turns);
      else failed.push(`${m.name}: ${result.error}`);
      // Generation is a burst of calls in a row; respect the same pause the
      // main run uses so this doesn't burn the day's quota on 429s.
      const wait = Number(config.delayMs) || 0;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }

    update(f.id, { transcripts: next });
    if (failed.length) setGenError((e) => ({ ...e, [f.id]: failed.join(" · ") }));
    setStatus("");
    setBusy(null);
  }

  function clearTranscripts(f) {
    update(f.id, { transcripts: {} });
    setPreview((p) => ({ ...p, [f.id]: "" }));
  }

  return (
    <Panel
      open={open}
      onClose={onClose}
      title="Ways of asking"
      subtitle="Your question stays the same. Only what comes before it changes."
      footer={
        <button className="btn-primary w-full justify-center" onClick={onClose}>
          Done
        </button>
      }
    >
      {framings.map((f) => {
        const made = Object.keys(f.transcripts || {});
        const missing = ready.filter((m) => !made.includes(m.name));
        const shown = preview[f.id] && f.transcripts?.[preview[f.id]];

        return (
          <div key={f.id} className="card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                className="field py-1.5 font-medium"
                placeholder="Framing name"
                value={f.label}
                onChange={(e) => update(f.id, { label: e.target.value })}
              />
              {framings.length > 1 && (
                <button
                  className="btn-quiet text-[13px] shrink-0"
                  onClick={() =>
                    setProbe({ ...probe, framings: framings.filter((x) => x.id !== f.id) })
                  }
                >
                  remove
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!f.multi}
                onChange={(e) => update(f.id, { multi: e.target.checked })}
              />
              <span>Conversation</span>
              <span className="text-faint">
                {f.multi ? "asked at the end of an exchange" : "asked after a single opening"}
              </span>
            </label>

            <div>
              <textarea
                className="field h-24 resize-y"
                placeholder={
                  f.multi
                    ? "One user message per line. This stays put — generating replies won't overwrite it."
                    : "Leave empty to ask the question with nothing in front of it."
                }
                value={f.text}
                onChange={(e) => update(f.id, { text: e.target.value })}
              />
              {f.multi && (
                <p className="hint mt-1">
                  Your side of the conversation. Each model writes its own replies to it.
                </p>
              )}
            </div>

            {f.multi && framingTurns(f.text, true) && (
              <div className="rounded-lg border border-line bg-paper p-3 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="btn text-[13px]"
                    disabled={!ready.length || busy === f.id}
                    onClick={() => generate(f)}
                  >
                    {busy === f.id
                      ? `Holding the conversation… ${status}`
                      : made.length
                        ? "Regenerate for all models"
                        : `Generate replies · ${ready.length} model${ready.length === 1 ? "" : "s"}`}
                  </button>
                  {made.length > 0 && (
                    <button
                      className="btn-quiet text-[13px]"
                      disabled={busy === f.id}
                      onClick={() => clearTranscripts(f)}
                    >
                      clear
                    </button>
                  )}
                  {!ready.length && <span className="hint">Connect a model first.</span>}
                </div>

                {ready.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {ready.map((m) => {
                      const has = made.includes(m.name);
                      return (
                        <button
                          key={m.name}
                          disabled={busy === f.id}
                          onClick={() =>
                            has
                              ? setPreview((p) => ({
                                  ...p,
                                  [f.id]: p[f.id] === m.name ? "" : m.name,
                                }))
                              : generate(f, m.name)
                          }
                          className={`px-2 py-1 rounded-lg border text-[12.5px] transition ${
                            has
                              ? "border-good/40 bg-good/5 text-ink"
                              : "border-line text-faint hover:border-accent/50"
                          }`}
                          title={has ? "Show what this model wrote" : "Generate for this model"}
                        >
                          {has ? "✓ " : "+ "}
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {missing.length > 0 && made.length > 0 && (
                  <p className="text-[12.5px] text-warn leading-relaxed">
                    No conversation yet for {missing.map((m) => m.name).join(", ")}. Those models
                    will be sent your script as plain messages instead, which is not the same
                    stimulus — generate before running.
                  </p>
                )}

                {shown && (
                  <div className="rounded-lg border border-line bg-card p-3 max-h-56 overflow-y-auto scroll-thin">
                    <p className="text-[12px] text-faint mb-1.5">{preview[f.id]} wrote:</p>
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{shown}</p>
                  </div>
                )}
              </div>
            )}

            {genError[f.id] && <p className="text-[13px] text-bad">{genError[f.id]}</p>}

            <div className="rounded-lg bg-paper border border-line p-3 text-[13px] leading-relaxed">
              <span className="text-faint whitespace-pre-wrap">
                {shown || f.text || "(nothing) "}
              </span>
              <span className="text-ink whitespace-pre-wrap">
                {"\n\n"}
                {measurement
                  ? measurement.slice(0, 90) + (measurement.length > 90 ? "…" : "")
                  : "your question"}
              </span>
              <span className="block mt-2 text-faint text-[12px]">
                grey = what comes before · black = your question, identical everywhere
              </span>
            </div>
          </div>
        );
      })}

      <button className="btn w-full justify-center" onClick={add}>
        + Add a framing
      </button>
    </Panel>
  );
}
