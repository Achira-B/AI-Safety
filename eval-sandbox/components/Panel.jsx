"use client";

import { useEffect } from "react";

/** A slide-over. Everything fiddly lives in one of these, never on the main surface. */
export default function Panel({ open, onClose, title, subtitle, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md bg-paper h-full shadow-pop flex flex-col rise">
        <div className="px-6 pt-6 pb-4 border-b border-line bg-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold leading-tight">{title}</h2>
              {subtitle && <p className="hint mt-1">{subtitle}</p>}
            </div>
            <button
              className="btn-quiet text-2xl leading-none -mt-1"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5 space-y-5">{children}</div>

        {footer && <div className="px-6 py-4 border-t border-line bg-card">{footer}</div>}
      </div>
    </div>
  );
}
