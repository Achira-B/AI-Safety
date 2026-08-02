"use client";

import { useMemo, useState } from "react";
import { EXTRACTORS, extractorById, applyExtractor } from "@/lib/extractors";

/**
 * Pick a spread of responses to eye-check: one from each model × framing cell
 * where possible, rather than the first five rows (which would all come from
 * the same cell and tell you nothing about the others).
 */
function sampleForCheck(rows, n = 5) {
  const byCell = new Map();
  for (const r of rows) {
    if (r.error) continue;
    const k = `${r.modelName}|${r.framingLabel}`;
    if (!byCell.has(k)) byCell.set(k, []);
    byCell.get(k).push(r);
  }
  const out = [];
  const cells = [...byCell.values()];
  let i = 0;
  while (out.length < n && cells.some((c) => c.length > i)) {
    for (const c of cells) {
      if (c[i] && out.length < n) out.push(c[i]);
    }
    i++;
  }
  return out;
}

function ResponseCard({ row, result, showAnnotation, onAnnotate }) {
  return (
    <div className="border border-edge rounded p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="tag">{row.modelName}</span>
        <span className="tag">{row.framingLabel}</span>
        <span className="tag">run {row.runIndex + 1}</span>
        <span className="ml-auto">
          {result.ok ? (
            <span className="text-good font-mono">signal = {result.value}</span>
          ) : (
            <span className="text-bad font-mono">extraction failed</span>
          )}
        </span>
      </div>

      <pre className="text-xs font-mono whitespace-pre-wrap bg-ink border border-edge rounded p-2.5 max-h-56 overflow-auto scroll-thin">
        {row.response}
      </pre>

      <div className="text-[11px] text-muted font-mono">{result.detail}</div>

      {showAnnotation && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted">your rating</span>
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              className={`w-6 h-6 rounded text-xs border ${
                row.manualRating === v
                  ? "bg-accent text-ink border-accent"
                  : "border-edge text-muted hover:border-accent"
              }`}
              onClick={() => onAnnotate(row.id, { manualRating: row.manualRating === v ? null : v })}
            >
              {v}
            </button>
          ))}
          <input
            className="input flex-1 text-xs py-1"
            placeholder="note (exported with the row)"
            value={row.manualNote || ""}
            onChange={(e) => onAnnotate(row.id, { manualNote: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

export default function ExtractPanel({
  rows,
  extractor,
  setExtractor,
  checked,
  setChecked,
  onAnnotate,
}) {
  const [showAll, setShowAll] = useState(false);
  const meta = extractorById(extractor.id);

  const applied = useMemo(
    () => rows.map((r) => ({ row: r, result: r.error ? { ok: false, detail: r.error } : applyExtractor(r.response, extractor) })),
    [rows, extractor]
  );

  const usable = applied.filter((a) => a.result.ok).length;
  const failed = applied.filter((a) => !a.row.error && !a.result.ok).length;
  const callFailed = applied.filter((a) => a.row.error).length;
  const failRate = rows.length ? failed / (rows.length - callFailed || 1) : 0;

  const sample = useMemo(() => sampleForCheck(rows, 5), [rows]);
  const sampleApplied = sample.map((r) => ({ row: r, result: applyExtractor(r.response, extractor) }));

  if (!rows.length) {
    return (
      <div className="panel p-4">
        <p className="note">Nothing to extract yet — run the grid first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="text-lg font-medium mb-1">Turn responses into a signal</h2>
        <p className="note">
          You define a rule <em>once</em>; it is applied identically to every response and every
          model. No model is asked to judge another model here — the rule is deterministic, so
          anyone can re-run it and get the same numbers. That is what makes a result checkable
          rather than merely plausible.
        </p>
      </div>

      <div className="panel p-4 space-y-3">
        <div>
          <span className="label">Extraction rule</span>
          <select
            className="input"
            value={extractor.id}
            onChange={(e) => {
              setExtractor({ ...extractor, id: e.target.value });
              setChecked(false);
            }}
          >
            {EXTRACTORS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          <p className="note mt-1">{meta.help}</p>
        </div>

        {(meta.needsItems || meta.needsTarget) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {meta.needsItems && (
              <div>
                <span className="label">Items listed in the probe</span>
                <input
                  type="number"
                  min={2}
                  max={12}
                  className="input"
                  value={extractor.nItems}
                  onChange={(e) => {
                    setExtractor({ ...extractor, nItems: Number(e.target.value) || 3 });
                    setChecked(false);
                  }}
                />
              </div>
            )}
            {meta.needsTarget && (
              <div>
                <span className="label">Which item is the target</span>
                <input
                  type="number"
                  min={1}
                  max={extractor.nItems}
                  className="input"
                  value={extractor.targetIndex}
                  onChange={(e) => {
                    setExtractor({ ...extractor, targetIndex: Number(e.target.value) || 1 });
                    setChecked(false);
                  }}
                />
              </div>
            )}
            <div>
              <span className="label">Scale min</span>
              <input
                type="number"
                className="input"
                value={extractor.min}
                onChange={(e) => setExtractor({ ...extractor, min: Number(e.target.value) })}
              />
            </div>
            <div>
              <span className="label">Scale max</span>
              <input
                type="number"
                className="input"
                value={extractor.max}
                onChange={(e) => setExtractor({ ...extractor, max: Number(e.target.value) })}
              />
            </div>
          </div>
        )}

        {(meta.needsKeywords || extractor.id === "refusal") && (
          <div>
            <span className="label">
              {extractor.id === "refusal" ? "Extra refusal phrases (optional)" : "Keywords"}
            </span>
            <input
              className="input"
              placeholder="comma separated"
              value={(extractor.keywords || []).join(", ")}
              onChange={(e) => {
                setExtractor({ ...extractor, keywords: e.target.value.split(",") });
                setChecked(false);
              }}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs pt-1">
          <span className="text-good">{usable} extracted</span>
          <span className={failed ? "text-bad" : "text-muted"}>{failed} extraction failures</span>
          <span className={callFailed ? "text-bad" : "text-muted"}>{callFailed} call failures</span>
        </div>

        {failRate > 0.15 && (
          <div className="text-xs text-warn border border-warn/40 rounded p-2">
            More than 15% of responses could not be parsed by this rule. A high failure rate is
            itself a finding — it usually means the models are answering in a shape you did not
            anticipate. Read a few failures before changing the rule, and be wary of tuning the rule
            until the numbers look how you hoped.
          </div>
        )}
      </div>

      <div className="panel p-4 space-y-3">
        <h3 className="text-base font-medium">Spot-check — read five, then trust the rule</h3>
        <p className="note">
          This is the discipline the whole tool is built around. You will never read 200 responses,
          and you should not have to. But you must read enough to be sure the rule is picking up
          what you think it is. Five, spread across models and framings, is the working minimum.
        </p>

        <div className="space-y-3">
          {sampleApplied.map(({ row, result }) => (
            <ResponseCard key={row.id} row={row} result={result} showAnnotation onAnnotate={onAnnotate} />
          ))}
        </div>

        <label className="flex items-start gap-2 text-sm pt-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>
            I have read these and the extracted signal matches what the response actually says.
            <span className="block note">
              Statistics stay locked until this is ticked. Not to be paternalistic — because a
              confident number computed from a broken rule is worse than no number.
            </span>
          </span>
        </label>
      </div>

      <div className="panel p-4">
        <button className="btn" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Hide" : "Show"} all {rows.length} responses
        </button>
        {showAll && (
          <div className="space-y-3 mt-4">
            {applied.map(({ row, result }) => (
              <ResponseCard
                key={row.id}
                row={row}
                result={result}
                showAnnotation
                onAnnotate={onAnnotate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
