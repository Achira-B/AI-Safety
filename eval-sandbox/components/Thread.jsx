"use client";

import { useEffect, useMemo, useState } from "react";

function ReplyColumn({ modelName, replies }) {
  const [i, setI] = useState(0);
  const r = replies[Math.min(i, replies.length - 1)];
  if (!r) return null;

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-medium text-[14px] truncate">{modelName}</span>
        {replies.length > 1 && (
          <div className="flex items-center gap-1 shrink-0 text-[13px] text-soft">
            <button
              className="px-1.5 hover:text-ink disabled:opacity-30"
              onClick={() => setI(Math.max(0, i - 1))}
              disabled={i === 0}
              aria-label="Previous reply"
            >
              ‹
            </button>
            <span className="tabular-nums">
              {i + 1}/{replies.length}
            </span>
            <button
              className="px-1.5 hover:text-ink disabled:opacity-30"
              onClick={() => setI(Math.min(replies.length - 1, i + 1))}
              disabled={i >= replies.length - 1}
              aria-label="Next reply"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div
        className={`flex-1 rounded-xl2 border p-3.5 text-[14px] leading-relaxed whitespace-pre-wrap
                    overflow-y-auto scroll-thin max-h-72 ${
                      r.error ? "border-bad/30 bg-bad/5 text-bad" : "border-line bg-paper"
                    }`}
      >
        {r.error ? `Didn't come back: ${r.error}` : r.response}
      </div>
    </div>
  );
}

export default function Thread({ question, rows, running, progress }) {
  const framings = useMemo(() => [...new Set(rows.map((r) => r.framingLabel))], [rows]);
  const models = useMemo(() => [...new Set(rows.map((r) => r.modelName))], [rows]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= framings.length) setActive(0);
  }, [framings.length, active]);

  const failures = rows.filter((r) => r.error).length;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl2 rounded-br-sm bg-accent text-white px-4 py-3
                        text-[15px] leading-relaxed whitespace-pre-wrap shadow-card">
          {question}
        </div>
      </div>

      {running && (
        <div className="card p-4 space-y-2.5 rise">
          <div className="flex items-center justify-between text-[14px]">
            <span>Asking…</span>
            <span className="text-soft tabular-nums">
              {progress.done} of {progress.total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-paper border border-line overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card overflow-hidden rise">
          <div className="px-4 pt-4 pb-3 border-b border-line">
            <p className="text-[14px]">
              {rows.length} {rows.length === 1 ? "reply" : "replies"} — {models.length} model
              {models.length === 1 ? "" : "s"}, {framings.length} way
              {framings.length === 1 ? "" : "s"} of asking.
              {failures > 0 && (
                <span className="text-bad">
                  {" "}
                  {failures} didn&apos;t come back and won&apos;t be counted.
                </span>
              )}
            </p>
          </div>

          {framings.length > 1 && (
            <div className="flex gap-1 px-3 pt-3 overflow-x-auto scroll-thin">
              {framings.map((f, i) => (
                <button
                  key={f}
                  onClick={() => setActive(i)}
                  className={`px-3 py-1.5 rounded-lg text-[14px] whitespace-nowrap transition ${
                    i === active
                      ? "bg-accentSoft text-accent font-medium"
                      : "text-soft hover:text-ink hover:bg-paper"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          <div className="p-4 flex flex-col md:flex-row gap-4">
            {models.map((m) => (
              <ReplyColumn
                key={`${m}-${framings[active]}`}
                modelName={m}
                replies={rows.filter(
                  (r) => r.modelName === m && r.framingLabel === framings[active]
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
