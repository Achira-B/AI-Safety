"use client";

import { useMemo } from "react";
import { EXTRACTORS, extractorById, applyExtractor } from "@/lib/extractors";

/** One reply per model × way-of-asking, so the check covers the whole spread. */
function spread(rows, n = 5) {
  const cells = new Map();
  for (const r of rows) {
    if (r.error) continue;
    const k = `${r.modelName}|${r.framingLabel}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(r);
  }
  const out = [];
  const groups = [...cells.values()];
  for (let i = 0; out.length < n && groups.some((g) => g.length > i); i++) {
    for (const g of groups) if (g[i] && out.length < n) out.push(g[i]);
  }
  return out;
}

export default function ScoreStep({ rows, extractor, setExtractor, checked, setChecked }) {
  const meta = extractorById(extractor.id);

  const all = useMemo(
    () =>
      rows
        .filter((r) => !r.error)
        .map((r) => applyExtractor(r.response, extractor)),
    [rows, extractor]
  );
  const unreadable = all.filter((a) => !a.ok).length;
  const unreadableRate = all.length ? unreadable / all.length : 0;

  const samples = useMemo(() => spread(rows, 5), [rows]);

  return (
    <div className="space-y-5 rise">
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="font-medium text-[17px]">What should I count?</h2>
          <p className="lede text-[14px] mt-1">
            Pick one thing to read out of every reply. The same rule is applied to all{" "}
            {rows.length} of them — nothing is judged by another AI, so the numbers come out the
            same every time and anyone can check them.
          </p>
        </div>

        <div className="grid gap-2">
          {EXTRACTORS.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                setExtractor({ ...extractor, id: e.id });
                setChecked(false);
              }}
              className={`text-left p-3 rounded-xl2 border transition ${
                extractor.id === e.id
                  ? "border-accent bg-accentSoft"
                  : "border-line hover:border-accent/50 bg-card"
              }`}
            >
              <span className="font-medium text-[14.5px]">{e.label}</span>
              <span className="block hint mt-0.5">{e.help}</span>
            </button>
          ))}
        </div>

        {(meta.needsItems || meta.needsTarget || meta.needsKeywords) && (
          <div className="rounded-xl2 border border-line bg-paper p-4 space-y-3">
            {meta.needsItems && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[14px]">My question lists</span>
                <input
                  type="number"
                  min={2}
                  max={12}
                  className="field w-20 py-1.5"
                  value={extractor.nItems}
                  onChange={(e) => {
                    setExtractor({ ...extractor, nItems: Number(e.target.value) || 3 });
                    setChecked(false);
                  }}
                />
                <span className="text-[14px]">options, and I care about number</span>
                <input
                  type="number"
                  min={1}
                  max={extractor.nItems}
                  className="field w-20 py-1.5"
                  value={extractor.targetIndex}
                  onChange={(e) => {
                    setExtractor({ ...extractor, targetIndex: Number(e.target.value) || 1 });
                    setChecked(false);
                  }}
                />
              </div>
            )}
            {meta.needsKeywords && (
              <div>
                <span className="label">Words to look for</span>
                <input
                  className="field"
                  placeholder="separate them with commas"
                  value={(extractor.keywords || []).join(", ")}
                  onChange={(e) => {
                    setExtractor({ ...extractor, keywords: e.target.value.split(",") });
                    setChecked(false);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {meta.caution && (
          <p className="text-[13.5px] text-warn leading-relaxed">{meta.caution}</p>
        )}

        {unreadableRate > 0.15 && (
          <div className="rounded-xl2 border border-warn/30 bg-warn/5 p-3.5 text-[13.5px] text-warn leading-relaxed">
            I couldn&apos;t read {unreadable} of {all.length} replies this way. That&apos;s worth
            paying attention to — usually it means the models answered in a shape you weren&apos;t
            expecting. Read a few of those before changing the rule, and be wary of yourself if you
            find you&apos;re adjusting it until the numbers look how you hoped.
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <h2 className="font-medium text-[17px]">Here&apos;s what I read. Does that look right?</h2>
          <p className="lede text-[14px] mt-1">
            Five replies, spread across every model and every way of asking. You don&apos;t have to
            read all {rows.length} — but read these, because everything after this point depends on
            me having read them correctly.
          </p>
        </div>

        <div className="space-y-3">
          {samples.map((row) => {
            const res = applyExtractor(row.response, extractor);
            return (
              <div key={row.id} className="rounded-xl2 border border-line overflow-hidden">
                <div className="px-3.5 py-2 bg-paper border-b border-line flex flex-wrap items-center gap-2 text-[13px] text-soft">
                  <span className="font-medium text-ink">{row.modelName}</span>
                  <span>·</span>
                  <span>{row.framingLabel}</span>
                  <span className="ml-auto">
                    {res.ok ? (
                      <span className="text-good font-medium">
                        I read: {res.value} {meta.plainUnit}
                      </span>
                    ) : (
                      <span className="text-bad font-medium">I couldn&apos;t read this one</span>
                    )}
                  </span>
                </div>
                <div className="p-3.5 text-[14px] leading-relaxed whitespace-pre-wrap max-h-44 overflow-y-auto scroll-thin">
                  {row.response}
                </div>
                {res.detail && (
                  <div className="px-3.5 pb-3 text-[12.5px] text-faint">{res.detail}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            className={checked ? "btn" : "btn-primary"}
            onClick={() => setChecked(true)}
            disabled={checked}
          >
            {checked ? "✓ Checked" : "Yes, that’s right — show me the results"}
          </button>
          {checked && (
            <button className="btn" onClick={() => setChecked(false)}>
              Actually, let me change it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
