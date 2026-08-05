"use client";

import { useRef, useEffect, useState } from "react";

const ONE_LINE = 46;
const MAX_H = 260;

function Chip({ children, onClick, warn }) {
  return (
    <button
      onClick={onClick}
      className={`chip ${warn ? "border-warn/40 text-warn hover:border-warn" : ""}`}
    >
      {children}
    </button>
  );
}

export default function Composer({
  value,
  onChange,
  onSend,
  models,
  probe,
  config,
  openSetup,
  openFramings,
  disabled,
  sending,
}) {
  const ref = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (collapsed) {
      el.style.height = ONE_LINE + "px";
      return;
    }
    el.style.height = "auto";
    el.style.height = Math.min(MAX_H, Math.max(ONE_LINE, el.scrollHeight)) + "px";
  }, [value, collapsed]);

  function handleSend() {
    if (disabled) return;
    setCollapsed(true);
    onSend();
  }

  const ready = models.filter((m) => m.enabled && m.name && m.modelId && m.apiKey);
  const ways = probe.framings.length;
  const total = ready.length * ways * config.runs;
  const long = value.length > 90 || value.includes("\n");

  return (
    <div className="space-y-3">
      <div className="card p-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 transition">
        <div className="relative">
          <textarea
            ref={ref}
            className={`w-full resize-none bg-transparent pl-3.5 pr-11 py-3 text-[16px] leading-relaxed
                        placeholder-faint focus:outline-none scroll-thin
                        ${collapsed ? "overflow-hidden whitespace-nowrap text-ellipsis" : "overflow-auto"}`}
            placeholder="What do you want to ask?"
            value={value}
            onChange={(e) => {
              if (collapsed) setCollapsed(false);
              onChange(e.target.value);
            }}
            onFocus={() => collapsed && setCollapsed(false)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !disabled) handleSend();
            }}
          />

          {long && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand the question" : "Collapse the question"}
              title={collapsed ? "Expand" : "Collapse"}
              className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-md
                         text-soft hover:text-ink hover:bg-paper border border-transparent
                         hover:border-line transition"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                {collapsed ? (
                  <path
                    d="M4 10l4-4 4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-2 pb-1.5">
          <Chip onClick={openSetup} warn={ready.length === 0}>
            {ready.length === 0
              ? "Connect a model"
              : ready.length === 1
                ? ready[0].name
                : `${ready.length} models`}
          </Chip>
          <Chip onClick={openFramings}>
            {ways} way{ways === 1 ? "" : "s"} of asking
          </Chip>
          <Chip onClick={openSetup}>{config.runs}× each</Chip>

          <div className="ml-auto flex items-center gap-3">
            {total > 0 && (
              <span className="text-[13px] text-faint hidden sm:inline">
                {total} {total === 1 ? "reply" : "replies"}
              </span>
            )}
            <button className="btn-primary" onClick={handleSend} disabled={disabled}>
              {sending ? "Asking…" : "Ask"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
