"use client";

import { useEffect, useRef, useState } from "react";
import SetupPanel, { blankModel } from "@/components/SetupPanel";
import FramingsPanel from "@/components/FramingsPanel";
import HelpPanel from "@/components/HelpPanel";
import Composer from "@/components/Composer";
import Thread from "@/components/Thread";
import ScoreStep from "@/components/ScoreStep";
import ResultStep from "@/components/ResultStep";
import { framingTurns, renderTurns } from "@/lib/turns";

const STORAGE_KEY = "eval-sandbox-v0";

const DEFAULT_FRAMINGS = [{ id: "f0", label: "", text: "", multi: false }];

const DEFAULT_CONFIG = { runs: 5, temperature: 1, maxTokens: 400, concurrency: 3 };
const DEFAULT_EXTRACTOR = {
  id: "favouritism",
  nItems: 3,
  targetIndex: 1,
  keywords: [],
  min: 0,
  max: 10,
};

const EXAMPLE =
  "Rate each of the following from 1 to 10 on overall quality. Give one number per item, numbered.\n\n1. \n2. \n3. ";

export default function Page() {
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [models, setModels] = useState([blankModel(0)]);
  const [probe, setProbe] = useState({ measurement: "", framings: DEFAULT_FRAMINGS });
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [extractor, setExtractor] = useState(DEFAULT_EXTRACTOR);
  const [rows, setRows] = useState([]);
  const [checked, setChecked] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [remember, setRemember] = useState(true);
  const [panel, setPanel] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const cancelRef = useRef(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.models?.length) setModels(s.models);
        if (s.framings?.length) setProbe((p) => ({ ...p, framings: s.framings }));
        if (s.draft) setDraft(s.draft);
        if (s.config) setConfig(s.config);
        if (s.extractor) setExtractor(s.extractor);
        if (typeof s.remember === "boolean") setRemember(s.remember);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          models: models.map(({ status, apiKey, ...m }) => ({
            ...m,
            apiKey: remember ? apiKey : "",
          })),
          framings: probe.framings,
          draft,
          config,
          extractor,
          remember,
        })
      );
    } catch {}
  }, [models, probe.framings, draft, config, extractor, remember, loaded]);

  useEffect(() => {
    if (rows.length && !running) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows.length, running]);

  const readyModels = models.filter((m) => m.enabled && m.name && m.modelId && m.apiKey);
  const canAsk = readyModels.length > 0 && draft.trim().length > 0 && !running;

  async function ask() {
    if (!draft.trim()) return;
    if (!readyModels.length) {
      setPanel("setup");
      return;
    }

    const measurement = draft.trim();
    setProbe((p) => ({ ...p, measurement }));
    setQuestion(measurement);

    const jobs = [];
    for (const m of readyModels) {
      for (const f of probe.framings) {
        // Conversation mode is an explicit per-framing switch. When it's on,
        // the measurement is asked as the final user turn of the exchange.
        const priorTurns = framingTurns(f.text, f.multi);
        const turns = priorTurns
          ? [...priorTurns, { role: "user", content: measurement }]
          : null;

        for (let i = 0; i < config.runs; i++) {
          jobs.push({
            id: `${m.name}|${f.label}|${i}|${jobs.length}`,
            modelName: m.name,
            provider: m.provider,
            baseUrl: m.baseUrl,
            modelId: m.modelId,
            apiKey: m.apiKey,
            framingLabel: f.label,
            framingText: f.text,
            measurementText: measurement,
            turns,
            turnCount: turns ? turns.length : 1,
            // Always a readable record of everything the model saw, so the
            // CSV and the spot-check show the real input either way.
            prompt: turns ? renderTurns(turns) : `${f.text}${measurement}`,
            runIndex: i,
            temperature: config.temperature,
          });
        }
      }
    }

    cancelRef.current = false;
    setRunning(true);
    setChecked(false);
    setRows([]);
    setProgress({ done: 0, total: jobs.length });

    let cursor = 0;
    let done = 0;
    const collected = [];

    async function worker() {
      while (cursor < jobs.length && !cancelRef.current) {
        const job = jobs[cursor++];
        let response = "";
        let error = "";
        // Rate limits are transient and vary by provider and tier, so back off
        // and retry rather than asking anyone to know each provider's limit.
        let delay = 1500;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const res = await fetch("/api/run", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: job.provider,
                baseUrl: job.baseUrl,
                modelId: job.modelId,
                apiKey: job.apiKey,
                prompt: job.prompt,
                turns: job.turns,
                temperature: config.temperature,
                maxTokens: config.maxTokens,
              }),
            });
            const data = await res.json();
            if (data.ok) {
              response = data.text;
              error = "";
              break;
            }
            error = data.error || `HTTP ${res.status}`;
          } catch (err) {
            error = String(err?.message || err);
          }
          const rateLimited = /\b429\b|rate.?limit|too many requests/i.test(error);
          if (!rateLimited || cancelRef.current) break;
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
        }
        const { apiKey, ...safe } = job;
        collected.push({
          ...safe,
          timestamp: new Date().toISOString(),
          response,
          error,
          manualRating: null,
          manualNote: "",
        });
        done += 1;
        setProgress({ done, total: jobs.length });
        setRows([...collected]);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(config.concurrency, jobs.length) }, () => worker())
    );
    setRunning(false);
  }

  function clearAll() {
    if (!confirm("Clear your models, keys, questions and results from this browser?")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setModels([blankModel(0)]);
    setProbe({ measurement: "", framings: DEFAULT_FRAMINGS });
    setConfig(DEFAULT_CONFIG);
    setExtractor(DEFAULT_EXTRACTOR);
    setRows([]);
    setDraft("");
    setQuestion("");
    setChecked(false);
    setPanel(null);
  }

  const fresh = rows.length === 0 && !running;
  const modelCount = new Set(rows.map((r) => r.modelName)).size;
  // Side-by-side columns need room: 768px across four models is ~170px each.
  const wide = modelCount > 1 ? "max-w-6xl" : "max-w-3xl";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-3">
          <span className="w-[7px] h-[7px] rounded-full bg-accent shrink-0" aria-hidden />
          <span className="font-semibold tracking-[-0.01em]">Eval Sandbox</span>
          <button className="btn-quiet text-[14px] ml-auto" onClick={() => setPanel("help")}>
            How this works
          </button>
          {rows.length > 0 && (
            <button
              className="btn-quiet text-[14px]"
              onClick={() => {
                setRows([]);
                setChecked(false);
                setQuestion("");
              }}
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <main className={`flex-1 w-full ${wide} mx-auto px-5 py-8 space-y-7 transition-[max-width] duration-300`}>
        {fresh && (
          <div className="py-6 rise">
            <span className="rule" aria-hidden />
            <p className="kicker mb-3">Elicitation sweep</p>
            <h1 className="display max-w-xl">
              Ask one question several ways. See whether the answer changes.
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-7">
              {!readyModels.length ? (
                <button className="btn-primary" onClick={() => setPanel("setup")}>
                  Connect a model
                </button>
              ) : (
                !draft && (
                  <button
                    className="btn-quiet text-[14px] underline"
                    onClick={() => setDraft(EXAMPLE)}
                  >
                    start from an example question
                  </button>
                )
              )}
              <button className="btn-quiet text-[14px]" onClick={() => setPanel("help")}>
                How this works
              </button>
            </div>
          </div>
        )}

        {!fresh && (
          <Thread question={question} rows={rows} running={running} progress={progress} />
        )}

        {rows.length > 0 && !running && (
          <ScoreStep
            rows={rows}
            extractor={extractor}
            setExtractor={setExtractor}
            checked={checked}
            setChecked={setChecked}
          />
        )}

        {rows.length > 0 && !running && checked && (
          <ResultStep rows={rows} extractor={extractor} probe={probe} config={config} />
        )}

        <div ref={bottomRef} />
      </main>

      <div className="sticky bottom-0 border-t border-line bg-paper/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 py-4">
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={ask}
            models={models}
            probe={probe}
            config={config}
            openSetup={() => setPanel("setup")}
            openFramings={() => setPanel("framings")}
            disabled={!canAsk}
            sending={running}
          />
        </div>
      </div>

      <SetupPanel
        open={panel === "setup"}
        onClose={() => setPanel(null)}
        models={models}
        setModels={setModels}
        config={config}
        setConfig={setConfig}
        remember={remember}
        setRemember={setRemember}
        onClearAll={clearAll}
      />
      <FramingsPanel
        open={panel === "framings"}
        onClose={() => setPanel(null)}
        probe={{ ...probe, measurement: probe.measurement || draft }}
        setProbe={setProbe}
        models={models}
        config={config}
      />
      <HelpPanel open={panel === "help"} onClose={() => setPanel(null)} />
    </div>
  );
}
