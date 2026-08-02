# Eval Sandbox

Ask one question several different ways, across several models, several times
each — and see whether the answers change.

The question stays word-for-word identical every time. Only the sentence in
front of it changes. That's the whole idea: if a model answers differently when
it can tell it's being tested, this is what shows you.

---

## Using it

**1. Connect a model.** Click *Connect a model*, give it a name you'll recognise,
pick the provider, paste your key. Up to three.

**2. Type your question.** One question, in the big box.

**3. Choose your ways of asking.** Three are set up already — plain, sounds like
a test, sounds like a real person. Edit them or add your own.

**4. Press Ask.** Every model gets the question under every framing, five times
each. Replies come back side by side.

**5. Say what to count.** Pick one thing to read out of every reply — a score, a
refusal, a preference. The same rule is applied to all of them.

**6. Check the working.** Five replies are shown with what was read from each.
Confirm it looks right, and the results appear.

Nothing is saved anywhere. Close the tab and it's gone, so export what you want
to keep.

---

## A few things worth knowing

**Why the question can't change between versions.** If the question and the
framing both changed, and the answers came out different, you'd have no way of
telling which one caused it. The app builds every prompt as framing + question
so it can't drift.

**Why it asks five times.** Models don't repeat themselves exactly. Ask once and
you might be looking at a fluke.

**Why it makes you check its working.** The number is read out of each reply by a
fixed rule, so the same replies always give the same numbers and anyone can
check them. But a rule can misread. An average built on a misreading looks
exactly as convincing as a correct one, which is what makes it dangerous.

**Reading the chart.** The bar is the average; the line through it is how sure
you can be given how few times you asked. **If two lines overlap a lot, treat the
bars as the same** — that's the most useful habit to build.

**What it can't tell you.** It can't tell you a model is biased. It can show you
that its answers shift with the framing, which is narrower and much easier to
defend. And if the options you compared weren't genuinely equal to begin with, a
preference between them might simply be correct.

---

## Where your keys go

They're typed into the browser and kept there. Each request passes the key
straight through this app's own relay to the model provider. Nothing is written
to a server, a database, or a log — there are no accounts and no storage.

The relay exists only because browsers aren't allowed to call the OpenAI or
Anthropic APIs directly.

- Deploy this publicly and anyone can open it, but they must bring their own
  key, so there's no cost to you.
- Anyone using your computer can read the stored keys. Untick *remember my keys*
  on a shared machine, or use *Clear everything*.
- `app/api/run/route.js` has a list of provider addresses it will talk to. That's
  what stops a public copy being used as an open proxy. Add to it only if you
  trust the host.

---

## Running it on your own machine

You need [Node.js](https://nodejs.org) 18 or newer. In a terminal, from inside
this folder:

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

To check the maths and the reading rules still behave:

```bash
npm test
```

That runs 31 hand-worked assertions. If it says `0 failed`, the engine under the
interface is doing what it claims.

---

## Putting it online with Vercel

**Without a terminal:**

1. Put this folder in a GitHub repository — GitHub Desktop is the least painful
   way.
2. Go to [vercel.com/new](https://vercel.com/new) and import it.
3. Vercel detects Next.js by itself. Leave everything at the defaults and press
   Deploy. There are **no environment variables to set** — keys are supplied in
   the browser, never at build time.

**With a terminal:**

```bash
npm i -g vercel
vercel
```

One thing to know: each model call is one serverless request, and on Vercel's
free plan those can run for 60 seconds. A slow model with a long reply limit can
overrun and show a timeout. Lower the reply length in advanced settings, or use a
faster model.

---

## The technical names for all this

Kept out of the interface on purpose, but useful if you're writing this up.

| In the app | The term |
|---|---|
| Asking one fixed question several ways | **elicitation sweep** |
| The fixed question | the **measurement** or **probe** |
| Each opening line | an **elicitation** or **framing** |
| The rule that reads a number out of a reply | an **extractor** |
| The number itself | the **signal** |
| Checking five by eye before trusting the rest | **spot-checking** |
| The line through each bar | a 95% **bootstrap confidence interval** |
| "How often they said the same thing" | **modal agreement** |
| Comparing against equally good options | a **matched control**; the gap is **selectivity** |

The confidence interval is a percentile bootstrap — resampling your own data
rather than assuming it's normally distributed, because ratings out of ten
aren't. The bootstrap is seeded, so the same data always gives the same interval.

---

## What's deliberately missing

No AI judge, no accounts, no shared dashboard, no automated matched controls, no
multi-turn framings. Each carries a validity question this version doesn't have
to answer.

If it grows, the order that makes sense: a matched control condition reporting
selectivity and false-positive rate → a build-your-own rule editor → saved
sessions. An AI-judge tier shouldn't arrive without a measure of how well it
agrees with human ratings shipped alongside it.

---

## Structure

```
app/
  page.jsx            the whole flow and the run engine
  api/run/route.js    the stateless relay to model providers
components/
  Composer.jsx        the question box and its chips
  Thread.jsx          replies, side by side
  ScoreStep.jsx       what to count, and the check-my-working gate
  ResultStep.jsx      chart, numbers, exports
  SetupPanel.jsx      models and run settings (slide-over)
  FramingsPanel.jsx   ways of asking (slide-over)
  HelpPanel.jsx       plain-language explainer (slide-over)
  Panel.jsx           the slide-over itself
lib/
  extractors.js       the reading rules
  stats.js            averages, spread, seeded bootstrap intervals
  csv.js              exports
  selftest.mjs        the assertions behind npm test
```
