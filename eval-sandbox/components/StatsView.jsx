"use client";

import { useMemo } from "react";
import { applyExtractor, extractorById } from "@/lib/extractors";
import { summariseByCell, fmt } from "@/lib/stats";
import { rowsToCSV, summaryToCSV, download } from "@/lib/csv";

const MODEL_COLOURS = ["#7aa2f7", "#9ece6a", "#e0af68", "#bb9af7"];

function Chart({ cells, unit }) {
  if (!cells.length) return null;

  const framings = [...new Set(cells.map((c) => c.framingLabel))];
  const models = [...new Set(cells.map((c) => c.modelName))];

  const lows = cells.map((c) => c.ciLo).filter(Number.isFinite);
  const highs = cells.map((c) => c.ciHi).filter(Number.isFinite);
  if (!lows.length) return null;

  let yMin = Math.min(0, ...lows);
  let yMax = Math.max(...highs);
  const pad = (yMax - yMin) * 0.15 || 1;
  yMin -= pad;
  yMax += pad;

  const W = 720;
  const H = 340;
  const M = { top: 20, right: 20, bottom: 64, left: 56 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const y = (v) => M.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const groupW = plotW / framings.length;
  const barW = Math.min(52, (groupW * 0.7) / models.length);

  const ticks = 5;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / ticks);

  return (
    <div className="overflow-x-auto scroll-thin">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]">
        {tickVals.map((v, i) => (
          <g key={i}>
            <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="#2a323d" strokeWidth="1" />
            <text x={M.left - 8} y={y(v) + 4} textAnchor="end" fill="#8b96a5" fontSize="11">
              {fmt(v, 1)}
            </text>
          </g>
        ))}
        {yMin < 0 && yMax > 0 && (
          <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#5a6673" strokeWidth="1.5" />
        )}

        {framings.map((f, fi) => {
          const gx = M.left + fi * groupW;
          return (
            <g key={f}>
              {models.map((m, mi) => {
                const cell = cells.find((c) => c.framingLabel === f && c.modelName === m);
                if (!cell || !Number.isFinite(cell.mean)) return null;
                const x =
                  gx + groupW / 2 - (models.length * barW) / 2 + mi * barW + barW * 0.1;
                const w = barW * 0.8;
                const top = y(Math.max(cell.mean, 0));
                const base = y(Math.min(cell.mean, 0));
                return (
                  <g key={m}>
                    <rect
                      x={x}
                      y={top}
                      width={w}
                      height={Math.max(1, base - top)}
                      fill={MODEL_COLOURS[mi % MODEL_COLOURS.length]}
                      opacity="0.85"
                      rx="2"
                    />
                    {Number.isFinite(cell.ciLo) && (
                      <g stroke="#e6edf3" strokeWidth="1.5">
                        <line x1={x + w / 2} x2={x + w / 2} y1={y(cell.ciLo)} y2={y(cell.ciHi)} />
                        <line x1={x + w / 2 - 5} x2={x + w / 2 + 5} y1={y(cell.ciLo)} y2={y(cell.ciLo)} />
                        <line x1={x + w / 2 - 5} x2={x + w / 2 + 5} y1={y(cell.ciHi)} y2={y(cell.ciHi)} />
                      </g>
                    )}
                  </g>
                );
              })}
              <text
                x={gx + groupW / 2}
                y={H - M.bottom + 18}
                textAnchor="middle"
                fill="#8b96a5"
                fontSize="11"
              >
                {f.length > 18 ? f.slice(0, 17) + "…" : f}
              </text>
            </g>
          );
        })}

        <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + plotH} stroke="#2a323d" />
        <line
          x1={M.left}
          x2={W - M.right}
          y1={M.top + plotH}
          y2={M.top + plotH}
          stroke="#2a323d"
        />

        {models.map((m, mi) => (
          <g key={m} transform={`translate(${M.left + mi * 130}, ${H - 18})`}>
            <rect width="10" height="10" y="-9" fill={MODEL_COLOURS[mi % MODEL_COLOURS.length]} rx="2" />
            <text x="16" fill="#8b96a5" fontSize="11">
              {m}
            </text>
          </g>
        ))}

        <text
          transform={`translate(14, ${M.top + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
          fill="#8b96a5"
          fontSize="11"
        >
          {unit}
        </text>
      </svg>
    </div>
  );
}

export default function StatsView({ rows, extractor, checked, probe, config }) {
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

  if (!rows.length) {
    return (
      <div className="panel p-4">
        <p className="note">No results yet.</p>
      </div>
    );
  }

  if (!checked) {
    return (
      <div className="panel p-6 text-center space-y-2">
        <div className="text-warn text-sm">Statistics are locked.</div>
        <p className="note max-w-lg mx-auto">
          Go back to <strong className="text-slate-200">Extract</strong>, read the five sampled
          responses, and confirm the rule is picking up what you think it is. A mean computed from a
          broken extractor looks exactly as authoritative as a correct one — which is the whole
          problem.
        </p>
      </div>
    );
  }

  const thin = cells.filter((c) => c.n > 0 && c.n < 5);
  const totalUsed = cells.reduce((a, c) => a + c.n, 0);

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="text-lg font-medium mb-1">The pattern</h2>
        <p className="note">
          Bars are cell means; the whiskers are 95% bootstrap confidence intervals — the range where
          the true mean plausibly sits, given how few runs you did. Read the{" "}
          <em>overlap</em>, not the bar heights: if two intervals overlap heavily, you have not
          shown a difference, however different the bars look. The finding is usually the{" "}
          <em>shape across framings</em>, not any single cell.
        </p>
      </div>

      <div className="panel p-4">
        <Chart cells={cells} unit={meta.unit} />
      </div>

      {thin.length > 0 && (
        <div className="panel p-3 border-warn/40">
          <p className="text-xs text-warn">
            {thin.length} cell{thin.length === 1 ? " has" : "s have"} fewer than 5 usable responses.
            Confidence intervals that narrow are not to be trusted — bootstrap intervals on tiny
            samples are optimistic. Treat these as a pilot, not a result.
          </p>
        </div>
      )}

      <div className="panel p-4 overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-edge">
              <th className="py-2 pr-4">model</th>
              <th className="py-2 pr-4">framing</th>
              <th className="py-2 pr-4 text-right">n</th>
              <th className="py-2 pr-4 text-right">mean</th>
              <th className="py-2 pr-4 text-right">95% CI</th>
              <th className="py-2 pr-4 text-right">sd</th>
              <th className="py-2 pr-4 text-right">most common</th>
              <th className="py-2 pr-4 text-right">dropped</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {cells.map((c) => (
              <tr key={`${c.modelName}|${c.framingLabel}`} className="border-b border-edge/50">
                <td className="py-2 pr-4">{c.modelName}</td>
                <td className="py-2 pr-4 font-sans">{c.framingLabel}</td>
                <td className="py-2 pr-4 text-right">{c.n}</td>
                <td className="py-2 pr-4 text-right">{fmt(c.mean)}</td>
                <td className="py-2 pr-4 text-right text-muted">
                  [{fmt(c.ciLo)}, {fmt(c.ciHi)}]
                </td>
                <td className="py-2 pr-4 text-right text-muted">{fmt(c.sd)}</td>
                <td className="py-2 pr-4 text-right text-muted">
                  {fmt(c.modalValue, 0)} ({fmt(c.modalShare * 100, 0)}%)
                </td>
                <td className="py-2 pr-4 text-right">
                  {c.failedCall + c.failedExtract > 0 ? (
                    <span className="text-bad">{c.failedCall + c.failedExtract}</span>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note mt-3">
          &quot;most common&quot; is the single value that came up most often and the share of runs
          that gave it — the plainest measure of how consistent a model is with itself. {totalUsed}{" "}
          of {rows.length} responses contributed to these numbers.
        </p>
      </div>

      <div className="panel p-4 flex flex-wrap gap-3">
        <button
          className="btn"
          onClick={() =>
            download(`eval-rows-${Date.now()}.csv`, rowsToCSV(scored, extractor))
          }
        >
          Export all responses (CSV)
        </button>
        <button
          className="btn"
          onClick={() => download(`eval-summary-${Date.now()}.csv`, summaryToCSV(cells))}
        >
          Export summary (CSV)
        </button>
        <button
          className="btn"
          onClick={() =>
            download(
              `eval-config-${Date.now()}.json`,
              JSON.stringify({ probe, config, extractor, exportedAt: new Date().toISOString() }, null, 2)
            )
          }
        >
          Export run configuration (JSON)
        </button>
        <p className="note w-full">
          The row export contains every prompt and every raw response, so the run can be audited or
          re-run by someone else. Export it before you close the tab — nothing is stored on a server.
        </p>
      </div>
    </div>
  );
}
