// lib/selftest.mjs — run with `npm test`.
//
// Checks the two pieces where a silent bug would poison every result: the
// extraction rules and the statistics. Expected values below were worked out by
// hand, not copied from the code's own output.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
async function load(name) {
  const src = readFileSync(join(here, name), "utf8");
  return import("data:text/javascript," + encodeURIComponent(src));
}

const { applyExtractor, itemRatings } = await load("extractors.js");
const { mean, sd, median, modalAgreement, bootstrapCI, summariseByCell } = await load("stats.js");

let pass = 0;
let fail = 0;

function check(name, actual, expected, tol = 1e-9) {
  const ok =
    typeof expected === "number"
      ? Math.abs(actual - expected) <= tol
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}\n       expected ${JSON.stringify(expected)}\n       got      ${JSON.stringify(actual)}`);
  }
}

console.log("\nitem rating parsing");
check(
  "numbered list with prose",
  itemRatings("1. Acme Ltd — solid track record, 8\n2. Borden Co — 6\n3. Cray Group — 7", 3).value,
  [8, 6, 7]
);
check(
  "x/10 form",
  itemRatings("1. Acme: 9/10\n2. Borden: 5/10\n3. Cray: 6/10", 3).value,
  [9, 5, 6]
);
check(
  "parenthetical year must not be mistaken for a rating",
  itemRatings("1. Acme (founded 1998) — 7\n2. Borden (founded 2004) — 4\n3. Cray — 5", 3).value,
  [7, 4, 5]
);
check("bare numbers fallback", itemRatings("8\n7\n9", 3).value, [8, 7, 9]);
check("too few ratings fails loudly", itemRatings("1. Acme — 8", 3).ok, false);

console.log("\nextractors");
check(
  "favouritism: target above matched others",
  applyExtractor("1. Acme — 9\n2. Borden — 6\n3. Cray — 6", {
    id: "favouritism",
    nItems: 3,
    targetIndex: 1,
  }).value,
  3 // 9 - mean(6,6) = 3
);
check(
  "favouritism: target is item 2",
  applyExtractor("1. Acme — 4\n2. Borden — 8\n3. Cray — 6", {
    id: "favouritism",
    nItems: 3,
    targetIndex: 2,
  }).value,
  3 // 8 - mean(4,6) = 3
);
check(
  "favouritism can be negative",
  applyExtractor("1. Acme — 3\n2. Borden — 8\n3. Cray — 7", {
    id: "favouritism",
    nItems: 3,
    targetIndex: 1,
  }).value,
  -4.5 // 3 - mean(8,7) = -4.5
);
check(
  "item_score picks the right item",
  applyExtractor("1. Acme — 4\n2. Borden — 8\n3. Cray — 6", {
    id: "item_score",
    nItems: 3,
    targetIndex: 3,
  }).value,
  6
);
check("first_number", applyExtractor("I'd say 7 out of 10.", { id: "first_number" }).value, 7);
check(
  "refusal detected",
  applyExtractor("I'm sorry, I can't help with that request.", { id: "refusal" }).value,
  1
);
check(
  "compliance not flagged as refusal",
  applyExtractor("Sure — here are the three scores: 8, 7, 9.", { id: "refusal" }).value,
  0
);
check("word_count", applyExtractor("one two three four", { id: "word_count" }).value, 4);
check(
  "keyword hit",
  applyExtractor("This raises safety concerns.", { id: "keyword", keywords: ["safety"] }).value,
  1
);
check("empty response fails", applyExtractor("", { id: "first_number" }).ok, false);

console.log("\nstatistics");
check("mean", mean([2, 4, 6]), 4);
check("sd uses n-1", sd([2, 4, 6]), 2); // var = (4+0+4)/2 = 4
check("sd undefined for n=1", Number.isNaN(sd([5])), true);
check("median even", median([1, 2, 3, 4]), 2.5);
check("median odd", median([3, 1, 2]), 2);
check("modal agreement", modalAgreement([7, 7, 7, 8, 9]).share, 0.6);
check("modal value", modalAgreement([7, 7, 7, 8, 9]).value, 7);

const ci = bootstrapCI([5, 5, 5, 5, 5]);
check("CI collapses on zero-variance data", ci.lo === 5 && ci.hi === 5, true);

const ciA = bootstrapCI([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const ciB = bootstrapCI([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
check("CI is reproducible across calls", ciA.lo === ciB.lo && ciA.hi === ciB.hi, true);
check("CI brackets the mean", ciA.lo <= 5.5 && ciA.hi >= 5.5, true);

console.log("\ncell summary");
const cells = summariseByCell([
  { modelName: "a", framingLabel: "f1", extractOk: true, signal: 4, error: "" },
  { modelName: "a", framingLabel: "f1", extractOk: true, signal: 6, error: "" },
  { modelName: "a", framingLabel: "f1", extractOk: false, signal: null, error: "" },
  { modelName: "a", framingLabel: "f1", extractOk: false, signal: null, error: "timeout" },
  { modelName: "b", framingLabel: "f1", extractOk: true, signal: 9, error: "" },
]);
const a = cells.find((c) => c.modelName === "a");
check("failed rows excluded from mean", a.mean, 5);
check("attempted counts everything", a.attempted, 4);
check("call failures counted separately", a.failedCall, 1);
check("extraction failures counted separately", a.failedExtract, 1);
check("n reflects usable rows only", a.n, 2);
check("cells split by model", cells.length, 2);

// ---------------------------------------------------------------------------
// Conversation turns
//
// A framing can be a whole conversation. The risk here is silent: a parser that
// mangles a transcript still returns something, and the run proceeds against an
// input nobody looked at. So check the boundaries, not just the happy path.

const { parseTurns, renderTurns, linesToUserTurns, framingTurns } = await load("turns.js");

console.log("\nconversation turns");

check("no markers means single-message mode", parseTurns("Below is a report:\n"), null);
check("empty text means single-message mode", parseTurns(""), null);
check("null text means single-message mode", parseTurns(null), null);

check("splits a transcript into turns", parseTurns("USER: hi\nASSISTANT: hello\nUSER: ok"), [
  { role: "user", content: "hi" },
  { role: "assistant", content: "hello" },
  { role: "user", content: "ok" },
]);

check("markers are case-insensitive", parseTurns("user: a\nAssistant: b"), [
  { role: "user", content: "a" },
  { role: "assistant", content: "b" },
]);

// A colon mid-sentence must not be read as a role marker, or any transcript
// containing "note:" or "problem:" silently loses a turn.
check("only line-start markers count", parseTurns("USER: note: a colon\nASSISTANT: fine"), [
  { role: "user", content: "note: a colon" },
  { role: "assistant", content: "fine" },
]);

check("blank turns are dropped", parseTurns("USER: a\nASSISTANT:\nUSER: b"), [
  { role: "user", content: "a" },
  { role: "user", content: "b" },
]);

// The CSV has to show what the model actually saw, or the spot-check is a lie.
check(
  "render round-trips a transcript",
  renderTurns([
    { role: "user", content: "a" },
    { role: "assistant", content: "b" },
  ]),
  "USER: a\n\nASSISTANT: b"
);

check("each line is a user turn before generation", linesToUserTurns("first\n\nsecond\n"), [
  { role: "user", content: "first" },
  { role: "user", content: "second" },
]);

// Conversation mode is a switch, not a guess. A prompt that happens to contain
// "USER:" must not silently become a transcript when the switch is off.
check("switch off means prefix mode", framingTurns("USER: hi\nASSISTANT: there", false), null);
check("switch on, plain lines become user turns", framingTurns("hi\nthere", true), [
  { role: "user", content: "hi" },
  { role: "user", content: "there" },
]);
check("switch on, a generated transcript keeps its roles", framingTurns("USER: hi\nASSISTANT: there", true), [
  { role: "user", content: "hi" },
  { role: "assistant", content: "there" },
]);
check("switch on with nothing typed", framingTurns("   ", true), null);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
