"use client";

export default function RunPanel({
  models,
  probe,
  config,
  setConfig,
  onRun,
  onCancel,
  running,
  progress,
  rows,
}) {
  const activeModels = models.filter((m) => m.enabled && m.name && m.modelId && m.apiKey);
  const framings = probe.framings.filter((f) => f.label);
  const total = activeModels.length * framings.length * config.runs;

  const problems = [];
  if (!probe.measurement.trim()) problems.push("The measurement box is empty.");
  if (!activeModels.length) problems.push("No model slot is complete and enabled.");
  if (!framings.length) problems.push("No framings defined.");
  if (total > 300) problems.push(`${total} calls is a lot for a v0 run — consider trimming.`);

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="text-lg font-medium mb-1">Run the grid</h2>
        <p className="note">
          Every cell is one model × one framing, repeated {config.runs}×. Repetition is not padding:
          a model&apos;s answer varies run to run, so a single response tells you nothing about
          whether a difference is real. Temperature is kept identical across conditions for the same
          reason the measurement is.
        </p>
      </div>

      <div className="panel p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <span className="label">Runs per cell</span>
          <input
            type="number"
            min={1}
            max={20}
            className="input"
            value={config.runs}
            onChange={(e) =>
              setConfig({ ...config, runs: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })
            }
          />
        </div>
        <div>
          <span className="label">Temperature</span>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            className="input"
            value={config.temperature}
            onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) })}
          />
        </div>
        <div>
          <span className="label">Max tokens</span>
          <input
            type="number"
            min={16}
            max={4096}
            step={16}
            className="input"
            value={config.maxTokens}
            onChange={(e) => setConfig({ ...config, maxTokens: Number(e.target.value) })}
          />
        </div>
        <div>
          <span className="label">Parallel calls</span>
          <input
            type="number"
            min={1}
            max={8}
            className="input"
            value={config.concurrency}
            onChange={(e) =>
              setConfig({
                ...config,
                concurrency: Math.max(1, Math.min(8, Number(e.target.value) || 1)),
              })
            }
          />
        </div>
      </div>

      <div className="panel p-4">
        <div className="text-sm mb-2">
          <span className="text-muted">Grid: </span>
          {activeModels.length} model{activeModels.length === 1 ? "" : "s"} × {framings.length}{" "}
          framing{framings.length === 1 ? "" : "s"} × {config.runs} run
          {config.runs === 1 ? "" : "s"} ={" "}
          <strong className="text-slate-100">{total} calls</strong>
        </div>
        {problems.length > 0 && (
          <ul className="text-xs text-warn space-y-1 mb-3">
            {problems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        )}

        {running ? (
          <div className="space-y-2">
            <div className="h-2 bg-ink border border-edge rounded overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {progress.done} / {progress.total} calls
                {progress.errors > 0 && (
                  <span className="text-bad"> · {progress.errors} failed</span>
                )}
              </span>
              <button className="btn-ghost" onClick={onCancel}>
                stop
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn-primary"
            disabled={!activeModels.length || !framings.length || !probe.measurement.trim()}
            onClick={onRun}
          >
            {rows.length ? "Run again (replaces results)" : `Run ${total} calls`}
          </button>
        )}
      </div>

      {rows.length > 0 && !running && (
        <div className="panel p-4">
          <p className="note">
            {rows.length} responses collected.{" "}
            {rows.filter((r) => r.error).length > 0 && (
              <span className="text-bad">
                {rows.filter((r) => r.error).length} calls failed — they are kept in the table and
                excluded from the statistics.
              </span>
            )}{" "}
            Next: choose how to turn responses into numbers, and check the rule by eye.
          </p>
        </div>
      )}
    </div>
  );
}
