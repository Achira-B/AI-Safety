"use client";

import { useState } from "react";
import Panel from "./Panel";

const PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    example: "gpt-4o-mini",
    where: "platform.openai.com → API keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    example: "claude-sonnet-4-5",
    where: "console.anthropic.com → API keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    provider: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    example: "gemini-3.5-flash",
    where: "aistudio.google.com → Get API key",
  },
  {
    id: "openrouter",
    label: "OpenRouter (many models, one key)",
    provider: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    example: "meta-llama/llama-3.3-70b-instruct",
    where: "openrouter.ai → Keys",
  },
  {
    id: "groq",
    label: "Groq",
    provider: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    example: "llama-3.3-70b-versatile",
    where: "console.groq.com → API keys",
  },
  {
    id: "mistral",
    label: "Mistral",
    provider: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    example: "mistral-large-latest",
    where: "console.mistral.ai → API keys",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    provider: "openai",
    baseUrl: "https://api.deepseek.com",
    example: "deepseek-chat",
    where: "platform.deepseek.com → API keys",
  },
];

export function blankModel(n) {
  return {
    id: `m${Date.now()}${n}`,
    name: "",
    preset: "openai",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    modelId: "",
    apiKey: "",
    enabled: true,
    status: null,
  };
}

function ModelCard({ model, index, onChange, onRemove, canRemove }) {
  const [testing, setTesting] = useState(false);
  const [open, setOpen] = useState(!model.modelId);
  const preset = PROVIDERS.find((p) => p.id === model.preset) || PROVIDERS[0];
  const ready = model.name && model.modelId && model.apiKey;

  async function test() {
    setTesting(true);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: model.provider,
          baseUrl: model.baseUrl,
          modelId: model.modelId,
          apiKey: model.apiKey,
          prompt: "Reply with exactly the word: ready",
          temperature: 0,
          maxTokens: 256,
          mode: "check",
        }),
      });
      const data = await res.json();
      onChange({
        status: data.ok
          ? { ok: true, message: data.note || "Working." }
          : { ok: false, message: data.error || "Something went wrong." },
      });
    } catch (err) {
      onChange({ status: { ok: false, message: String(err?.message || err) } });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="checkbox"
            className="accent-accent"
            checked={model.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          <input
            className="field py-1.5 font-medium"
            placeholder={`Name it — e.g. "GPT" or "Claude"`}
            value={model.name}
            onChange={(e) => onChange({ name: e.target.value, status: null })}
          />
        </label>
        {canRemove && (
          <button className="btn-quiet text-[13px]" onClick={onRemove}>
            remove
          </button>
        )}
      </div>

      {!open ? (
        <div className="flex items-center gap-3 text-[13px] text-soft">
          <span className="truncate">
            {preset.label.split(" (")[0]} · {model.modelId || "no model chosen"}
          </span>
          <button className="btn-quiet ml-auto shrink-0" onClick={() => setOpen(true)}>
            edit
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <span className="label">Who provides it</span>
            <select
              className="field"
              value={model.preset}
              onChange={(e) => {
                const p = PROVIDERS.find((x) => x.id === e.target.value);
                onChange({
                  preset: p.id,
                  provider: p.provider,
                  baseUrl: p.baseUrl,
                  status: null,
                });
              }}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">Which model</span>
            <input
              className="field font-mono text-[14px]"
              placeholder={preset.example}
              value={model.modelId}
              onChange={(e) => onChange({ modelId: e.target.value, status: null })}
            />
            <p className="hint mt-1">
              The exact name the provider uses, e.g. <code>{preset.example}</code>.
            </p>
          </div>

          <div>
            <span className="label">Your key</span>
            <input
              className="field font-mono text-[14px]"
              type="password"
              autoComplete="off"
              placeholder="paste it here"
              value={model.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value, status: null })}
            />
            <p className="hint mt-1">Get one from {preset.where}.</p>
          </div>

          <details className="text-[13px]">
            <summary className="cursor-pointer text-soft hover:text-ink">
              Advanced: change the address it calls
            </summary>
            <input
              className="field font-mono text-[13px] mt-2"
              value={model.baseUrl}
              onChange={(e) => onChange({ baseUrl: e.target.value, status: null })}
            />
          </details>

          <div className="flex items-center gap-3 pt-1">
            <button className="btn" disabled={!ready || testing} onClick={test}>
              {testing ? "checking…" : "Check it works"}
            </button>
            {model.status && (
              <span
                className={`text-[13px] ${model.status.ok ? "text-good" : "text-bad"} truncate`}
              >
                {model.status.ok ? "✓ " : "✕ "}
                {model.status.message}
              </span>
            )}
            {ready && (
              <button className="btn-quiet text-[13px] ml-auto" onClick={() => setOpen(false)}>
                done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SetupPanel({
  open,
  onClose,
  models,
  setModels,
  config,
  setConfig,
  remember,
  setRemember,
  onClearAll,
  max = 8,
}) {
  return (
    <Panel
      open={open}
      onClose={onClose}
      title="Models"
      subtitle="Which models to ask, and how many times."
      footer={
        <div className="flex items-center justify-between">
          <button className="btn-quiet text-[13px]" onClick={onClearAll}>
            Clear everything
          </button>
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      }
    >
      {models.map((m, i) => (
        <ModelCard
          key={m.id}
          model={m}
          index={i}
          canRemove={models.length > 1}
          onChange={(patch) =>
            setModels(models.map((x) => (x.id === m.id ? { ...x, ...patch } : x)))
          }
          onRemove={() => setModels(models.filter((x) => x.id !== m.id))}
        />
      ))}

      {models.length < max && (
        <button className="btn w-full justify-center" onClick={() => setModels([...models, blankModel(models.length)])}>
          + Add another model
        </button>
      )}

      <div className="card p-4 space-y-4">
        <div>
          <span className="label">How many times to ask each one</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={20}
              className="flex-1 accent-accent"
              value={config.runs}
              onChange={(e) => setConfig({ ...config, runs: Number(e.target.value) })}
            />
            <span className="w-8 text-right font-medium">{config.runs}</span>
          </div>
          <p className="hint mt-1.5">
            Models don&apos;t give the same answer twice. Asking once tells you almost nothing —
            five or more lets you see whether a difference is real or just noise.
          </p>
        </div>

        <details className="text-[13px]">
          <summary className="cursor-pointer text-soft hover:text-ink">
            Advanced settings
          </summary>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <span className="label">Randomness</span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                className="field"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) })}
              />
            </div>
            <div>
              <span className="label">Reply length</span>
              <input
                type="number"
                min={16}
                max={4096}
                step={16}
                className="field"
                value={config.maxTokens}
                onChange={(e) => setConfig({ ...config, maxTokens: Number(e.target.value) })}
              />
            </div>
            <div>
              <span className="label">At once</span>
              <input
                type="number"
                min={1}
                max={8}
                className="field"
                value={config.concurrency}
                onChange={(e) => setConfig({ ...config, concurrency: Number(e.target.value) })}
              />
            </div>
            <div>
              <span className="label">Wait between</span>
              <input
                type="number"
                min={0}
                max={60000}
                step={250}
                className="field"
                value={config.delayMs ?? 0}
                onChange={(e) => setConfig({ ...config, delayMs: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <p className="hint mt-2">
            Randomness is kept the same for every model and every way of asking — otherwise a
            difference could be caused by that rather than by what you were testing.
          </p>
          <p className="hint mt-1">
            Free tiers often limit requests per minute as well as per day. If you are seeing 429s,
            set <em>At once</em> to 1 and <em>Wait between</em> to a few thousand milliseconds — a
            slow run that finishes beats a fast one full of holes. Reasoning models that emit a
            thinking block need <em>Reply length</em> well above 1000, or the answer never arrives.
          </p>
        </details>
      </div>

      <label className="flex items-start gap-2.5 text-[13px] text-soft cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 accent-accent"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        <span>
          Remember my keys in this browser.
          <span className="block">
            Keys stay on this computer and are only ever passed straight to the provider. Untick on
            a shared machine.
          </span>
        </span>
      </label>
    </Panel>
  );
}
