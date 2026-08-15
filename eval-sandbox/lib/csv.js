// lib/csv.js — export every row, raw response included. If it is not in the
// CSV it did not happen: the export is the audit trail for the run.

function cell(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const COLUMNS = [
  "run_id",
  "timestamp_utc",
  "model_name",
  "provider",
  "model_id",
  "temperature",
  "framing_label",
  "framing_text",
  "transcript_from",
  "measurement_text",
  "full_prompt",
  "run_index",
  "raw_response",
  "call_error",
  "extractor",
  "extractor_config",
  "extract_ok",
  "extract_detail",
  "signal",
  "manual_rating",
  "manual_note",
];

export function rowsToCSV(rows, extractorConfig) {
  const cfg = JSON.stringify(extractorConfig || {});
  const lines = [COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.timestamp,
        r.modelName,
        r.provider,
        r.modelId,
        r.temperature,
        r.framingLabel,
        r.framingText,
        r.transcriptFrom ?? "",
        r.measurementText,
        r.prompt,
        r.runIndex,
        r.response,
        r.error,
        extractorConfig?.id,
        cfg,
        r.error ? "" : r.extractOk ? 1 : 0,
        r.extractDetail,
        r.extractOk ? r.signal : "",
        r.manualRating ?? "",
        r.manualNote ?? "",
      ]
        .map(cell)
        .join(",")
    );
  }
  return lines.join("\n");
}

export function summaryToCSV(cells) {
  const cols = [
    "model_name",
    "framing_label",
    "n_used",
    "attempted",
    "failed_call",
    "failed_extract",
    "mean",
    "sd",
    "median",
    "ci95_lo",
    "ci95_hi",
    "modal_value",
    "modal_share",
    "min",
    "max",
  ];
  const lines = [cols.join(",")];
  for (const c of cells) {
    lines.push(
      [
        c.modelName,
        c.framingLabel,
        c.n,
        c.attempted,
        c.failedCall,
        c.failedExtract,
        c.mean,
        c.sd,
        c.median,
        c.ciLo,
        c.ciHi,
        c.modalValue,
        c.modalShare,
        c.min,
        c.max,
      ]
        .map(cell)
        .join(",")
    );
  }
  return lines.join("\n");
}

export function download(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
