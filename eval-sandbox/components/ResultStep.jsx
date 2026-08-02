"use client";

import { useMemo, useState } from "react";
import { applyExtractor, extractorById } from "@/lib/extractors";
import { summariseByCell, fmt } from "@/lib/stats";
import { rowsToCSV, summaryToCSV, download } from "@/lib/csv";

const COLOURS = ["#4f46e5", "#0d9488", "#b45309", "#9333ea"];

function overlap(a, b) {
  return a.ciLo <= b.ciHi && b.ciLo <= a.ciHi;
}

function Chart({ cells, unit }) {
  const framings = [...new Set(cells.map((c) => c.framingLabel))];
  const models = [...new Set(cells.map((c) => c.modelName))];
  const lows = cells.map((c) => c.ciLo).filter(Number.isFinite);
  const highs = cells.map((c) => c.ciHi).filter(Number.isFinite);
  if (!lows.length) return null;

  let yMin = Math.min(0, ...lows);
  let yMax = Math.max(...highs, 0);
  const pad = (yMax - yMin) * 0.18 || 1;
  yMin -= pad;
  yMax += pad;

  const W = 700;
  const H = 320;
  const M = { top: 16, right: 16, bottom: 58, left: 48 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const y = (v) => M.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const groupW = plotW / framings.length;
  const barW = Math.min(56, (groupW * 0.62) / models.length);

  const ticks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);

  return (
    <div className="overflow-x-auto scroll-thin">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]">
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="#efece8" />
            <text x={M.left - 10} y={y(v) + 4} textAnchor="end" fill="#a8a29e" fontSize="11">
              {fmt(v, 1)}
            </text>
          </g>
        ))}
        {yMin < 0 && yMax > 0 && (
          <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#d6d3d1" strokeWidth="1.5" />
        )}

        {framings.map((f, fi) => {
          const gx = M.left + fi * groupW;
          return (
            <g key={f}>
              {models.map((m, mi) => {
                const c = cells.find((x) => x.framingLabel === f && x.modelName === m);
                if (!c || !Number.isFinite(c.mean)) return null;
                const x = gx + groupW / 2 - (models.length * barW) / 2 + mi * barW + barW * 0.12;
                const w = barW * 0.76;
                const top = y(Math.max(c.mean, 0));
                const base = y(Math.min(c.mean, 0));
                return (
                  <g key={m}>
                    <rect
                      x={x}
                      y={top}
                      width={w}
                      height={Math.max(1.5, base - top)}
                      fill={COLOURS[mi % COLOURS.length]}
                      opacity="0.9"
                      rx="3"
                    />
                    {Number.isFinite(c.ciLo) && (
                      <g stroke="#57534e" strokeWidth="1.4" strokeLinecap="round">
                        <line x1={x + w / 2} x2={x + w / 2} y1={y(c.ciLo)} y2={y(c.ciHi)} />
                        <line x1={x + w / 2 - 5} x2={x + w / 2 + 5} y1={y(c.ciLo)} y2={y(c.ciLo)} />
                        <line x1={x + w / 2 - 5} x2={x + w / 2 + 5} y1={y(c.ciHi)} y2={y(c.ciHi)} />
                      </g>
                    )}
                  </g>
                );
              })}
              <text
                x={gx + groupW / 2}
                y={H - M.bottom + 20}
                textAnchor="middle"
                fill="#78716c"
                fontSize="12"
              >
                {f.length > 20 ? f.slice(0, 19) + "…" : f}
              </text>
            </g>
          );
        })}

        <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} stroke="#e8e5e1" />

        {models.map((m, mi) => (
          <g key={m} transform={`translate(${M.left + mi * 140}, ${H - 12})`}>
            <rect width="10" height="10" y="-9" rx="2" fill={COLOURS[mi % COLOURS.length]} />
            <text x="16" fill="#78716c" fontSize="12">
              {m}
            </text>
          </g>
        ))}

        <text
          transform={`translate(13, ${M.top + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
          fill="#a8a29e"
          fontSize="11"
        >
          {unit}
        </text>
      </svg>
    </div>
  );
}

export default function ResultStep({ rows, extractor, probe, config }) {
  const [showNumbers, setShowNumbers] = useState(false);
  const meta = extractorById(extractor.id);

  const scored = useMemo(
    () =>
      rows.map((r) => {
        if (r.error) return { ...r, extractOk: false, signal: null, extractDetail: r.error };
        const res = applyExtractor(r.response, extractor);
        return { ...r, extractOk: res.ok, signal: res.value, extractDetail: res.detail };
      }),
    [rows, extractor]
  );

  const cells = useMemo(() => summariseByCell(scored), [scored]);
  const usable = cells.filter((c) => c.n > 0);

  if (!usable.length) {
    return (
      <div className="card p-5 rise">
        <p className="lede">
          Nothing could be read out of these replies with that rule, so there is nothing to show.
          Try a different thing to count.
        </p>
      </div>
    );
  }

  const sorted = [...usable].sort((a, b) => b.mean - a.mean);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const same = sorted.length > 1 && overlap(top, bottom);
  const thin = usable.filter((c) => c.n < 5);
  const used = usable.reduce((a, c) => a + c.n, 0);

  return (
    <div className="space-y-5 rise">
      <div className="card p-5 space-y-4">
        <h2 className="font-medium text-[17px]">What came out</h2>

        {sorted.length > 1 ? (
          <p className="text-[15px] leading-relaxed">
            Highest was{" "}
            <strong>
              {top.modelName} asked &ldquo;{top.framingLabel}&rdquo;
            </strong>{" "}
            at {fmt(top.mean)}. Lowest was{" "}
            <strong>
              {bottom.modelName} asked &ldquo;{bottom.framingLabel}&rdquo;
            </strong>{" "}
            at {fmt(bottom.mean)}.{" "}
            {same ? (
              <span className="text-warn">
                But their ranges overlap, so on this much evidence that gap could easily be noise —
                it isn&apos;t a finding yet.
              </span>
            ) : (
              <span className="text-good">
                Their ranges don&apos;t overlap, so the difference between those two is unlikely to
                be chance alone.
              </span>
            )}
          </p>
        ) : (
          <p className="text-[15px]">
            {top.modelName} averaged {fmt(top.mean)} {meta.plainUnit}.
          </p>
        )}

        <Chart cells={usable} unit={meta.plainUnit} />

        <p className="hint">
          Bars are the average. The line through each one is how sure we can be, given you only
          asked {config.runs} time{config.runs === 1 ? "" : "s"}.{" "}
          <strong className="text-ink font-medium">
            Where two lines overlap, treat the bars as the same.
          </strong>
        </p>

        {thin.length > 0 && (
          <p className="text-[13.5px] text-warn leading-relaxed">
            {thin.length === usable.length ? "Every group has" : `${thin.length} group(s) have`}{" "}
            fewer than five usable replies. Treat this as a first look rather than a result — the
            ranges shown are more optimistic than they should be.
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        <button
          className="w-full px-5 py-3.5 flex items-center justify-between text-[14px] hover:bg-paper transition"
          onClick={() => setShowNumbers(!showNumbers)}
        >
          <span>Show me the actual numbers</span>
          <span className="text-soft">{showNumbers ? "−" : "+"}</span>
        </button>

        {showNumbers && (
          <div className="px-5 pb-5 overflow-x-auto scroll-thin">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-left text-[12.5px] text-soft border-b border-line">
                  <th className="py-2 pr-4 font-medium">model</th>
                  <th className="py-2 pr-4 font-medium">way of asking</th>
                  <th className="py-2 pr-4 font-medium text-right">replies used</th>
                  <th className="py-2 pr-4 font-medium text-right">average</th>
                  <th className="py-2 pr-4 font-medium text-right">probably between</th>
                  <th className="py-2 pr-4 font-medium text-right">said the same</th>
                  <th className="py-2 font-medium text-right">skipped</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {usable.map((c) => (
                  <tr key={`${c.modelName}|${c.framingLabel}`} className="border-b border-line/60">
                    <td className="py-2 pr-4">{c.modelName}</td>
                    <td className="py-2 pr-4">{c.framingLabel}</td>
                    <td className="py-2 pr-4 text-right">{c.n}</td>
                    <td className="py-2 pr-4 text-right font-medium">{fmt(c.mean)}</td>
                    <td className="py-2 pr-4 text-right text-soft">
                      {fmt(c.ciLo)} – {fmt(c.ciHi)}
                    </td>
                    <td className="py-2 pr-4 text-right text-soft">
                      {fmt(c.modalShare * 100, 0)}% said {fmt(c.modalValue, 0)}
                    </td>
                    <td className="py-2 text-right">
                      {c.failedCall + c.failedExtract > 0 ? (
                        <span className="text-bad">{c.failedCall + c.failedExtract}</span>
                      ) : (
                        <span className="text-faint">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint mt-3">
              &ldquo;Said the same&rdquo; is how often a model repeated its most common answer — the
              plainest measure of how consistent it is with itself. {used} of {rows.length} replies
              went into these numbers.
            </p>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-3">
        <p className="text-[14px] font-medium">Keep a copy</p>
        <p className="hint">
          Nothing is saved anywhere. Close the tab and this is gone — so if it matters, download it
          now. The full export includes every prompt and every reply, so someone else could check
          your working or repeat the run.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button
            className="btn"
            onClick={() => download(`replies-${Date.now()}.csv`, rowsToCSV(scored, extractor))}
          >
            Every reply (spreadsheet)
          </button>
          <button
            className="btn"
            onClick={() => download(`summary-${Date.now()}.csv`, summaryToCSV(usable))}
          >
            Just the summary
          </button>
          <button
            className="btn"
            onClick={() =>
              download(
                `setup-${Date.now()}.json`,
                JSON.stringify(
                  { probe, config, extractor, exportedAt: new Date().toISOString() },
                  null,
                  2
                )
              )
            }
          >
            My setup
          </button>
        </div>
      </div>
    </div>
  );
}
