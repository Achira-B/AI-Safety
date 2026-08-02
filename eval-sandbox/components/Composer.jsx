"use client";

import { useRef, useEffect } from "react";

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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(320, Math.max(120, el.scrollHeight)) + "px";
  }, [value]);

  const ready = models.filter((m) => m.enabled && m.name && m.modelId && m.apiKey);
  const ways = probe.framings.length;
  const total = ready.length * ways * config.runs;

  return (
    <div className="space-y-3">
      <div className="card p-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 transition">
        <textarea
          ref={ref}
          className="w-full resize-none bg-transparent px-3.5 py-3 text-[16px] leading-relaxed
                     placeholder-faint focus:outline-none"
          placeholder={"What do you want to ask?\n\ne.g. Rate each of these out of 10 on overall quality:\n1. …\n2. …\n3. …"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !disabled) onSend();
          }}
        />

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
          <Chip onClick={openSetup}>
            {config.runs}× each
          </Chip>

          <div className="ml-auto flex items-center gap-3">
            {total > 0 && (
              <span className="text-[13px] text-faint hidden sm:inline">
                {total} {total === 1 ? "reply" : "replies"}
              </span>
            )}
            <button className="btn-primary" onClick={onSend} disabled={disabled}>
              {sending ? "Asking…" : "Ask"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
