"use client";

import { useState } from "react";

const PRESETS = [
  {
    id: "openai",
    label: "OpenAI",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    example: "gpt-4o-mini",
    keyHint: "sk-…",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    example: "claude-sonnet-4-5",
    keyHint: "sk-ant-…",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    provider: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    example: "meta-llama/llama-3.3-70b-instruct",
    keyHint: "sk-or-…",
  },
  {
    id: "groq",
    label: "Groq",
    provider: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    example: "llama-3.3-70b-versatile",
    keyHint: "gsk_…",
  },
  {
    id: "mistral",
    label: "Mistral",
    provider: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    example: "mistral-large-latest",
    keyHint: "…",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    provider: "openai",
    baseUrl: "https://api.deepseek.com",
    example: "deepseek-chat",
    keyHint: "sk-…",
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
    status: null, // { ok, message }
  };
}

export default function ModelShelf({ models, setModels, max = 3 }) {
  const [testing, setTesting] = useState(null);

  function update(id, patch) {
    setModels(models.map((m) => (m.id === id ? { ...m, ...patch, status: null } : m)));
  }

  function applyPreset(id, presetId) {
    const p = PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    update(id, { preset: p.id, provider: p.provider, baseUrl: p.baseUrl });
  }

  async function testModel(m) {
    setTesting(m.id);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: m.provider,
          baseUrl: m.baseUrl,
          modelId: m.modelId,
          apiKey: m.apiKey,
          prompt: "Reply with exactly the word: ready",
          temperature: 0,
          maxTokens: 16,
        }),
      });
      const data = await res.json();
      setModels((cur) =>
        cur.map((x) =>
          x.id === m.id
            ? {
                ...x,
                status: data.ok
                  ? { ok: true, message: `replied: "${(data.text || "").trim().slice(0, 40)}"` }
                  : { ok: false, message: data.error || "unknown error" },
              }
            : x
        )
      );
    } catch (err) {
      setModels((cur) =>
        cur.map((x) => (x.id === m.id ? { ...x, status: { ok: false, message: String(err) } } : x))
      );
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="text-lg font-medium mb-1">Model shelf</h2>
        <p className="note">
          Up to {max} models. Give each a short nickname — everything downstream refers to the
          nickname, not the model string. Keys are held in this browser only (
          <span className="font-mono">localStorage</span>), sent with each request to this app&apos;s
          own relay, and forwarded to the provider. They are never written to a server, a database,
          or a log.
        </p>
      </div>

      {models.map((m, i) => {
        const preset = PRESETS.find((p) => p.id === m.preset) || PRESETS[0];
        const ready = m.name && m.modelId && m.apiKey;
        return (
          <div key={m.id} className="panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="tag">slot {i + 1}</span>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={(e) => update(m.id, { enabled: e.target.checked })}
                  />
                  include in runs
                </label>
              </div>
              {models.length > 1 && (
                <button
                  className="btn-ghost"
                  onClick={() => setModels(models.filter((x) => x.id !== m.id))}
                >
                  remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <span className="label">Nickname</span>
                <input
                  className="input"
                  placeholder="e.g. sonnet"
                  value={m.name}
                  onChange={(e) => update(m.id, { name: e.target.value })}
                />
              </div>
              <div>
                <span className="label">Provider</span>
                <select
                  className="input"
                  value={m.preset}
                  onChange={(e) => applyPreset(m.id, e.target.value)}
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="label">Model ID</span>
                <input
                  className="input font-mono"
                  placeholder={preset.example}
                  value={m.modelId}
                  onChange={(e) => update(m.id, { modelId: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <span className="label">API key</span>
                <input
                  className="input font-mono"
                  type="password"
                  autoComplete="off"
                  placeholder={preset.keyHint}
                  value={m.apiKey}
                  onChange={(e) => update(m.id, { apiKey: e.target.value })}
                />
              </div>
              <div>
                <span className="label">Base URL</span>
                <input
                  className="input font-mono text-xs"
                  value={m.baseUrl}
                  onChange={(e) => update(m.id, { baseUrl: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="btn"
                disabled={!ready || testing === m.id}
                onClick={() => testModel(m)}
              >
                {testing === m.id ? "testing…" : "Test connection"}
              </button>
              {m.status && (
                <span className={`text-xs ${m.status.ok ? "text-good" : "text-bad"}`}>
                  {m.status.ok ? "✓ " : "✕ "}
                  {m.status.message}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {models.length < max && (
        <button className="btn" onClick={() => setModels([...models, blankModel(models.length)])}>
          + add a model ({models.length}/{max})
        </button>
      )}
    </div>
  );
}
