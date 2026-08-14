"use client";

import { useState } from "react";
import Panel from "./Panel";
import { parseTurns, renderTurns, framingTurns } from "@/lib/turns";
import { generateTranscript } from "@/lib/generate";

export default function FramingsPanel({ open, onClose, probe, setProbe, models = [], config = {} }) {
  const { framings, measurement } = probe;

  const [busy, setBusy] = useState(null);
  const [genError, setGenError] = useState({});
  const [genModel, setGenModel] = useState("");

  const ready = models.filter((m) => m.enabled && m.name && m.modelId && m.apiKey);
  const chosen = ready.find((m) => m.name === genModel) || ready[0];

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
        { id: `f${Date.now()}${framings.length}`, label: "", text: "", multi: false },
      ],
    });
  }

  // A conversation that has no assistant turns yet is waiting to be held.
  function needsReplies(f) {
    if (!f.multi) return false;
    const parsed = parseTurns(f.text);
    if (parsed) return parsed.every((t) => t.role === "user");
    return framingTurns(f.text, true) !== null;
  }

  async function generate(f) {
    const turns = framingTurns(f.text, true);
    if (!turns || !chosen) return;

    setBusy(f.id);
    setGenError((e) => ({ ...e, [f.id]: "" }));

    const result = await generateTranscript({
      model: chosen,
      userTurns: turns.filter((t) => t.role === "user").map((t) => t.content),
      temperature: config.temperature ?? 1,
      maxTokens: config.maxTokens ?? 512,
    });

    if (result.turns.length) update(f.id, { text: renderTurns(result.turns) });
    if (!result.ok) setGenError((e) => ({ ...e, [f.id]: result.error }));
    setBusy(null);
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
      {framings.map((f) => (
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

          <textarea
            className="field h-24 resize-y"
            placeholder={
              f.multi
                ? "One user message per line. Then generate the replies."
                : "Leave empty to ask the question with nothing in front of it."
            }
            value={f.text}
            onChange={(e) => update(f.id, { text: e.target.value })}
          />

          {needsReplies(f) && (
            <div className="flex items-center gap-2">
              <button
                className="btn text-[13px]"
                disabled={!chosen || busy === f.id}
                onClick={() => generate(f)}
              >
                {busy === f.id ? "Holding the conversation…" : "Generate replies"}
              </button>
              {ready.length > 1 && (
                <select
                  className="field py-1.5 text-[13px] w-auto"
                  value={chosen?.name ?? ""}
                  onChange={(e) => setGenModel(e.target.value)}
                >
                  {ready.map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              )}
              {!chosen && <span className="hint">Connect a model first.</span>}
            </div>
          )}

          {genError[f.id] && <p className="text-[13px] text-bad">{genError[f.id]}</p>}

          <div className="rounded-lg bg-paper border border-line p-3 text-[13px] leading-relaxed">
            <span className="text-faint whitespace-pre-wrap">{f.text || "(nothing) "}</span>
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
      ))}

      <button className="btn w-full justify-center" onClick={add}>
        + Add a framing
      </button>
    </Panel>
  );
}
