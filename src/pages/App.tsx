import { useEffect, useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import { baselineRelease, fixtures, proposedRelease, role } from "../data/seed";
import { computedReleaseComparison } from "../lib/release-comparison";
import { hardGateSummary } from "../lib/release-gates";

const gateForFixture = (fixtureId: string) =>
  computedReleaseComparison.checks.find(
    (check) => check.fixtureIds.includes(fixtureId) && check.isHardGate,
  );
const titleById = (id: string) =>
  fixtures.find((fixture) => fixture.id === id)?.title ?? id;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#/">
          Interview<span>Bench</span>
        </a>
        <p>Synthetic evaluation workspace</p>
      </header>
      {children}
    </main>
  );
}

function Comparison() {
  const {
    aggregateAgreement,
    baselineRuns,
    checks,
    proposedRuns,
    status: decision,
  } = computedReleaseComparison;
  const gates = hardGateSummary(checks);
  return (
    <Shell>
      <section className="page-head">
        <div>
          <nav>
            Roles <i>/</i> {role.title} <i>/</i> Release comparison
          </nav>
          <h1>{role.title}</h1>
          <p>
            Compare a proposed screening agent against a proven baseline across
            eight synthetic candidate scenarios.
          </p>
        </div>
        <div className="release-id">
          <StatusBadge status={decision} />
          <strong>
            {proposedRelease.name} · {proposedRelease.version}
          </strong>
          <small>
            vs {baselineRelease.name} · {baselineRelease.version}
          </small>
        </div>
      </section>
      <section className="decision-band">
        <div>
          <p className="eyebrow">Release decision</p>
          <h2>Do not enter the controlled pilot</h2>
          <p>
            This configuration decision never advances, rejects, or decides for
            a candidate.
          </p>
        </div>
        <a className="button" href="#gates">
          Review failed gates
        </a>
      </section>
      <section className="metric-grid" aria-label="Release metrics">
        <article className="metric">
          <p className="eyebrow">Aggregate agreement</p>
          <strong>{aggregateAgreement.percentage}%</strong>
          <p>
            {aggregateAgreement.matchedFixtures} of{" "}
            {aggregateAgreement.totalFixtures} pipeline traces agree with the
            baseline reference.
          </p>
          <small>Useful signal, not a release decision.</small>
        </article>
        <article className="metric metric--gate">
          <p className="eyebrow">Hard release gates</p>
          <strong>
            {gates.passed} of {gates.total} passed
          </strong>
          <p>
            These checks catch behaviors that must never ship without review.
          </p>
          <small>Hard release gates override aggregate agreement.</small>
        </article>
      </section>
      <section id="gates" className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Non-negotiable checks</p>
            <h2>Hard release gates</h2>
          </div>
          <span>{gates.failed} failed</span>
        </div>
        <div className="gate-list">
          {checks
            .filter((check) => check.isHardGate)
            .map((check) => (
              <a
                href={"#/failed-case/" + check.kind}
                className="gate-row"
                key={check.id}
              >
                <StatusBadge status={check.status} />
                <div>
                  <strong>{check.title}</strong>
                  <p>{check.rationale}</p>
                </div>
                <small>{check.fixtureIds.map(titleById).join(" · ")}</small>
              </a>
            ))}
        </div>
      </section>
      {checks
        .filter((check) => check.classification === "review_required")
        .map((check) => (
          <section className="panel" key={check.id}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Review-required finding</p>
                <h2>{check.title}</h2>
              </div>
              <a href={"#/failed-case/" + check.kind}>Review evidence</a>
            </div>
            <p>{check.rationale}</p>
            <small>
              This is not a fairness or legal-compliance verdict and does not
              block the release by itself.
            </small>
          </section>
        ))}
      <section className="panel scenarios">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Evaluation suite</p>
            <h2>Scenario comparison</h2>
          </div>
          <span>8 synthetic cases</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Category</th>
                <th>Baseline</th>
                <th>Proposed</th>
                <th>Gate impact</th>
              </tr>
            </thead>
            <tbody>
              {fixtures.map((fixture, index) => {
                const baseline = baselineRuns[index];
                const proposed = proposedRuns[index];
                const gate = gateForFixture(fixture.id);
                return (
                  <tr key={fixture.id} className={gate ? "row--fail" : ""}>
                    <td>
                      <strong>{fixture.title}</strong>
                      <span>{fixture.summary}</span>
                    </td>
                    <td>{fixture.category}</td>
                    <td>{baseline.terminalOutcome}</td>
                    <td>{proposed.terminalOutcome}</td>
                    <td>
                      {gate ? (
                        <a href={"#/failed-case/" + gate.kind}>{gate.title}</a>
                      ) : (
                        <em>—</em>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="footnote">
        All scenarios, candidate profiles, and agent responses in InterviewBench
        are synthetic.
      </p>
    </Shell>
  );
}

function FailedCase({ kind }: { kind: string }) {
  const check =
    computedReleaseComparison.checks.find((item) => item.kind === kind) ??
    computedReleaseComparison.checks[0];
  const fixture = fixtures.find((item) => item.id === check.fixtureIds[0]);
  const evidence = computedReleaseComparison.evidence.filter((item) =>
    check.evidenceIds.includes(item.id),
  );
  const baseline = computedReleaseComparison.baselineRuns.find(
    (run) => run.fixtureId === check.fixtureIds[0],
  );
  const proposed = computedReleaseComparison.proposedRuns.find(
    (run) => run.fixtureId === check.fixtureIds[0],
  );
  return (
    <Shell>
      <section className="page-head detail-head">
        <div>
          <nav>
            <a href="#/">Release comparison</a> <i>/</i> Failed case
          </nav>
          <p className="eyebrow">Computed evaluator finding</p>
          <h1>{check.title}</h1>
          <p>{fixture?.summary ?? check.rationale}</p>
        </div>
        <StatusBadge status="blocked" />
      </section>
      <section className="alert">
        <p className="eyebrow">
          {check.isHardGate
            ? check.classification === "human_reviewed_hard_gate"
              ? "Human-reviewed hard gate"
              : "Deterministic hard gate"
            : "Review-required finding"}
        </p>
        <h2>{check.rationale}</h2>
        <p>
          {check.isHardGate
            ? "Release-blocking for controlled-pilot entry."
            : "Review-required finding; this is not a fairness or legal-compliance verdict."}
        </p>
      </section>
      <div className="detail-grid">
        <section className="panel">
          <p className="eyebrow">Candidate message</p>
          <blockquote>
            “{fixture?.candidateMessage ?? "No candidate message."}”
          </blockquote>
          <p className="eyebrow">Expected behavior</p>
          <p>{fixture?.expectedBehavior}</p>
          <p className="eyebrow">Approved evidence</p>
          <ul>
            {(fixture?.approvedFacts ?? []).map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
        <section className="panel evidence">
          <p className="eyebrow">Evidence reviewed</p>
          {evidence.map((item) => (
            <div className="evidence-item" key={item.id}>
              <small>{item.label}</small>
              <p>“{item.excerpt}”</p>
            </div>
          ))}
          <span className="severity">
            {check.isHardGate ? "Release-blocking" : "Review required"}
          </span>
        </section>
      </div>
      <section className="response-grid">
        <article className="panel">
          <p className="eyebrow">Baseline pipeline</p>
          <p className="agent-response">{baseline?.terminalOutcome}</p>
          <StatusBadge status="pass" />
        </article>
        <article className="panel response--failed">
          <p className="eyebrow">Proposed pipeline</p>
          <p className="agent-response">{proposed?.terminalOutcome}</p>
          <StatusBadge status="fail" />
        </article>
      </section>
      <section className="resolution">
        <div>
          <p className="eyebrow">Required before release</p>
          <h2>Resolve the evaluator finding and rerun the computed suite.</h2>
          <p>Citation resolution remains separate from claim-support review.</p>
        </div>
        <a className="button button--quiet" href="#/">
          Back to comparison
        </a>
      </section>
    </Shell>
  );
}

export function App() {
  const [path, setPath] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setPath(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const kind = path.replace("#/failed-case/", "");
  return path.startsWith("#/failed-case/") ? (
    <FailedCase kind={kind} />
  ) : (
    <Comparison />
  );
}
