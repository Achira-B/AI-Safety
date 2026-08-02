# Eval Sandbox — v0

A no-code instrument for running an **elicitation sweep**: hold the measurement
constant, vary only the framing around it, run it across several models many
times, and see whether the behaviour moves.

The commercial no-code eval tools answer *"has our shipped chatbot regressed?"*.
This one answers a different question: *does this model behave differently when
it can tell it is being watched?*

---

## What v0 does

1. **Model shelf** — up to three models. Nickname, provider, model ID, API key.
   Everything downstream refers to the nickname.
2. **Probe builder** — two fields, kept separate on purpose. The *measurement*
   is sent byte-for-byte identical in every condition; the *framings* are what
   wraps around it. Every prompt is built as `framing + measurement`, so the
   measurement cannot drift between conditions without you noticing.
3. **Run the grid** — models × framings × N runs, with a progress bar and a stop
   button.
4. **Extract** — pick a deterministic rule from a dropdown; it is applied
   identically to every response. Then read five sampled responses and confirm
   the rule is picking up what you think it is. **Statistics stay locked until
   you do.**
5. **Results** — means with 95% bootstrap confidence intervals, consistency,
   a chart, and CSV export of every raw response.

### Deliberately not in v0

No AI judge, no accounts, no saved cross-user dashboard, no automated matched
controls, no multi-turn framings. Those are v2 in the scope document and each
one carries a validity question that v0 does not have to answer.

---

## Jargon, in plain terms

| Term | What it means here |
|---|---|
| **Probe** | The thing you ask the model. |
| **Measurement** | The part of the probe that produces the number you compare. Never varies. |
| **Framing / elicitation** | The wrapper around the measurement. The only thing that varies. |
| **Elicitation sweep** | Running the same measurement under several framings to see whether the answer depends on the costume. |
| **Extractor** | A fixed rule that turns a response into a number. Deterministic — no model judges another model. |
| **Signal** | The number the extractor produced for one response. |
| **Favouritism** | Target's rating minus the mean rating of the matched alternatives. Positive = target was favoured. |
| **Matched merit** | The alternatives are genuinely comparable, so a preference means bias rather than the target actually being better. |
| **Confidence interval (CI)** | The range where the true mean plausibly sits given how few runs you did. Overlapping intervals = you have not shown a difference. |
| **Bootstrap** | A way of computing that range by resampling your own data, rather than assuming it is bell-shaped. Ratings are not bell-shaped. |
| **Modal agreement** | The share of runs that gave the single most common answer. The plainest measure of a model's self-consistency. |

---

## Running it on your own machine

You need [Node.js](https://nodejs.org) (version 18 or newer). Then, in a
terminal, from inside this folder:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

To check the maths and the extraction rules are behaving:

```bash
npm test
```

That runs a set of hand-computed assertions against the extractors and the
statistics. If it prints `0 failed`, the engine underneath the interface is
doing what it claims.

---

## Deploying to Vercel

**The easy route (no terminal):**

1. Put this folder in a GitHub repository. GitHub Desktop is the least painful
   way if you would rather not use git on the command line.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Vercel will detect Next.js on its own. Leave every setting at its default and
   press Deploy. There are **no environment variables to set** — keys are
   supplied in the browser at run time, never at build time.
4. You get a URL. That is the whole deployment.

**The terminal route:**

```bash
npm i -g vercel
vercel
```

Answer the prompts with the defaults.

### One thing to know about function timeouts

Each model call is one serverless request. On Vercel's Hobby plan a function may
run for up to 60 seconds, which is set in `app/api/run/route.js`. A slow model
with a long `max tokens` can exceed that and the row will show a timeout error.
Lower max tokens or use a faster model if you see this.

---

## Where your API keys live

- Typed into the browser, kept in that browser's `localStorage`.
- Sent with **each** request to this app's own `/api/run` route, which forwards
  them to the provider and returns the text.
- **Never** written to a file, a database, a log, or an environment variable on
  the server.

The relay exists because a browser cannot call the Anthropic or OpenAI APIs
directly — the providers block cross-origin browser requests. The relay is the
minimum needed to get around that, and it is stateless.

**Consequences worth being clear about:**

- If you deploy this publicly, anyone can open the page — but they must supply
  their own key, so there is no cost leak to you.
- Anyone with access to your browser profile can read the stored keys. Untick
  *remember API keys in this browser* on a shared machine, or use **clear
  everything** in the footer when you are done.
- `app/api/run/route.js` has an allow-list of provider hostnames. That is what
  stops a public deployment being used as an open proxy to arbitrary URLs. Add
  to it only if you trust the host.

---

## Method notes — read before believing your own results

- **The measurement must not vary.** If it does, a gap between conditions could
  be caused by the question rather than the framing, and the result is
  uninterpretable. The two-field UI is there to make this hard to get wrong.
- **Repetition is not padding.** A model's answer varies run to run. One
  response per condition tells you nothing about whether a difference is real.
- **Read the interval overlap, not the bar heights.** Bars that look different
  with heavily overlapping intervals are not a finding.
- **A high extraction-failure rate is itself a result.** It usually means models
  are answering in a shape you did not anticipate. Read the failures before
  changing the rule — and be suspicious of yourself if you find you are tuning
  the rule until the numbers look how you hoped.
- **Fewer than five usable runs in a cell is a pilot, not a result.** Bootstrap
  intervals on tiny samples are optimistic.
- **Matched merit does the real work in a favouritism probe.** If the
  alternatives are not genuinely comparable, a preference for the target may
  simply be correct.

---

## Structure

```
app/
  page.jsx            the five-step flow and the run engine
  layout.jsx          shell
  globals.css         styling
  api/run/route.js    the stateless relay to model providers
components/
  ModelShelf.jsx      up to three model slots + connection test
  ProbeBuilder.jsx    measurement/framing split, framing ladder
  RunPanel.jsx        grid size, progress, cancel
  ExtractPanel.jsx    extractor config, spot-check gate, annotation
  StatsView.jsx       chart, summary table, exports
lib/
  extractors.js       the Tier 2 rules
  stats.js            mean, sd, seeded bootstrap CI, modal agreement
  csv.js              row and summary export
  selftest.mjs        hand-computed assertions (npm test)
```

The natural v1 additions, in the order they would earn their place: a matched
control condition with selectivity and false-positive rate; a user-defined
regex/keyword rule builder; saved sessions. The AI-judge tier should not arrive
without an agreement metric against human annotation shipped alongside it.
