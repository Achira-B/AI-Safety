"use client";

import Panel from "./Panel";

function Q({ q, children }) {
  return (
    <div className="space-y-1.5">
      <h3 className="font-medium">{q}</h3>
      <div className="lede text-[14px] space-y-2">{children}</div>
    </div>
  );
}

export default function HelpPanel({ open, onClose }) {
  return (
    <Panel
      open={open}
      onClose={onClose}
      title="How this works"
      subtitle="Four minutes, no jargon."
      footer={
        <button className="btn-primary w-full justify-center" onClick={onClose}>
          Got it
        </button>
      }
    >
      <Q q="What is this for?">
        <p>
          Finding out whether a model answers differently depending on <em>how</em> you ask —
          particularly whether it behaves better when it can tell it&apos;s being tested.
        </p>
        <p>
          You write one question. The tool asks it several ways, several times, across several
          models, and then shows you whether the answers actually moved.
        </p>
      </Q>

      <Q q="Why does the question have to stay identical?">
        <p>
          If you changed the question and the opening line at the same time, and the answers came
          out different, you&apos;d have no way of knowing which one caused it. Keeping the question
          fixed is what makes the comparison mean anything.
        </p>
      </Q>

      <Q q="Why ask the same thing more than once?">
        <p>
          Models don&apos;t repeat themselves exactly. Ask once and you might be looking at a fluke.
          Five or more times per version tells you whether a difference is a real pattern or just
          the model being chatty that morning.
        </p>
      </Q>

      <Q q="Why does it make me check its working?">
        <p>
          The tool reads a number out of each reply using a fixed rule — no AI is used to judge
          another AI here, so the same replies always give the same numbers, and anyone can check
          them.
        </p>
        <p>
          But a rule can misread. So before showing you any results, it shows you five replies and
          what it read from each. A confident-looking average built on a misreading is worse than no
          answer at all, and it looks exactly as convincing.
        </p>
      </Q>

      <Q q="What&apos;s the grey range on the chart?">
        <p>
          It&apos;s how sure the tool can be, given how few times you asked. The bar is the average;
          the line through it is the range the true answer probably sits in.
        </p>
        <p>
          <strong>If two ranges overlap a lot, you haven&apos;t found a difference</strong> — however
          different the bars look. That&apos;s the single most useful thing to know when reading it.
        </p>
      </Q>

      <Q q="Where do my keys go?">
        <p>
          They stay in this browser. Each request passes the key straight through to the model
          provider and nothing is stored on any server — no accounts, no database, no logs.
        </p>
        <p>Close the tab and your results are gone, so export anything you want to keep.</p>
      </Q>

      <Q q="What this tool can&apos;t do">
        <p>
          It can&apos;t tell you a model is biased. It can show you that its answers shift with the
          framing, which is a narrower and more defensible claim. If the options you compared
          weren&apos;t genuinely equal to begin with, a preference between them may simply be
          correct.
        </p>
      </Q>

      <details className="text-[13px] pt-2 border-t border-line">
        <summary className="cursor-pointer text-soft hover:text-ink">
          The technical names for all this
        </summary>
        <div className="mt-3 space-y-2 lede text-[13px]">
          <p>
            Asking one fixed question under several framings is an{" "}
            <strong>elicitation sweep</strong>. The fixed question is the{" "}
            <strong>measurement</strong>; each opening is an <strong>elicitation</strong> or{" "}
            <strong>framing</strong>.
          </p>
          <p>
            The rule that reads a number out of a reply is an <strong>extractor</strong>, and the
            number is the <strong>signal</strong>. Checking a handful by eye before trusting it at
            scale is <strong>spot-checking</strong>.
          </p>
          <p>
            The range on the chart is a 95% <strong>bootstrap confidence interval</strong> —
            computed by resampling your own data rather than assuming it&apos;s bell-shaped, because
            ratings out of ten are not. &ldquo;How often they said the same thing&rdquo; is{" "}
            <strong>modal agreement</strong>.
          </p>
          <p>
            Comparing your option against others of equal quality is a{" "}
            <strong>matched control</strong>, and the gap is <strong>selectivity</strong>.
          </p>
        </div>
      </details>
    </Panel>
  );
}
