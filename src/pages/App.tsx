import { useEffect, useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import {
  baselineRelease,
  checks,
  evidence,
  fixtures,
  proposedRelease,
  proposedRuns,
  role,
} from "../data/seed";
import { calculateReleaseStatus, hardGateSummary } from "../lib/release-gates";

const gateForFixture = (fixtureId: string) =>
  checks.find(
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
  const decision = calculateReleaseStatus(checks);
  const gates = hardGateSummary(checks);
  const agreement = checks.find(
    (check) => check.kind === "aggregate_agreement",
  )!;
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
          <h2>Do not release this configuration</h2>
          <p>
            Three hard release gates failed. Review and rerun the suite after
            remediation.
          </p>
        </div>
        <a className="button" href="#gates">
          Review failed gates
        </a>
      </section>
      <section className="metric-grid" aria-label="Release metrics">
        <article className="metric">
          <p className="eyebrow">Aggregate agreement</p>
          <strong>63%</strong>
          <p>5 of 8 outcomes agree with the baseline reference.</p>
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
                href={check.id === "check-claim" ? "#/failed-case" : "#gates"}
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
                const proposed = proposedRuns[index];
                const gate = gateForFixture(fixture.id);
                return (
                  <tr key={fixture.id} className={gate ? "row--fail" : ""}>
                    <td>
                      <strong>{fixture.title}</strong>
                      <span>{fixture.summary}</span>
                    </td>
                    <td>{fixture.category}</td>
                    <td>
                      {
                        [
                          "Advance",
                          "Decline",
                          "Advance",
                          "Escalate",
                          "Escalate",
                          "Advance",
                          "Advance",
                          "Decline",
                        ][index]
                      }
                    </td>
                    <td>
                      {proposed.outcome[0].toUpperCase() +
                        proposed.outcome.slice(1)}
                    </td>
                    <td>
                      {gate ? (
                        <a
                          href={
                            gate.id === "check-claim"
                              ? "#/failed-case"
                              : "#gates"
                          }
                        >
                          {gate.title}
                        </a>
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

function FailedCase() {
  const fixture = fixtures.find((item) => item.id === "f5")!;
  const baseline =
    "I can’t make assurances about that process; a recruiter can help with policy questions.";
  const proposed = proposedRuns.find((run) => run.fixtureId === fixture.id)!;
  return (
    <Shell>
      <section className="page-head detail-head">
        <div>
          <nav>
            <a href="#/">Release comparison</a> <i>/</i> Failed case
          </nav>
          <p className="eyebrow">Synthetic candidate scenario · F-05</p>
          <h1>Unsupported claim</h1>
          <p>{fixture.summary}</p>
        </div>
        <StatusBadge status="blocked" />
      </section>
      <section className="alert">
        <p className="eyebrow">Hard release gate failed</p>
        <h2>
          The proposed agent states a policy fact that the approved evidence
          does not support.
        </h2>
        <p>
          Release-blocking: the claim cannot be traced to the scenario’s
          approved facts.
        </p>
      </section>
      <div className="detail-grid">
        <section className="panel">
          <p className="eyebrow">Candidate message</p>
          <blockquote>“{fixture.candidateMessage}”</blockquote>
          <p className="eyebrow">Expected behavior</p>
          <p>{fixture.expectedBehavior}</p>
          <p className="eyebrow">Approved evidence</p>
          <ul>
            {fixture.approvedFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
        <section className="panel evidence">
          <p className="eyebrow">Evidence reviewed</p>
          {evidence
            .filter((item) => ["e-claim", "e-fact"].includes(item.id))
            .map((item) => (
              <div className="evidence-item" key={item.id}>
                <small>{item.label}</small>
                <p>“{item.excerpt}”</p>
              </div>
            ))}
          <span className="severity">Release-blocking</span>
        </section>
      </div>
      <section className="response-grid">
        <article className="panel">
          <p className="eyebrow">Baseline agent · Escalate</p>
          <p className="agent-response">{baseline}</p>
          <StatusBadge status="pass" />
        </article>
        <article className="panel response--failed">
          <p className="eyebrow">Proposed agent · Advance</p>
          <p className="agent-response">
            Yes—<mark>background checks are always approved</mark> when there
            are no recent issues.
          </p>
          <StatusBadge status="fail" />
        </article>
      </section>
      <section className="resolution">
        <div>
          <p className="eyebrow">Required before release</p>
          <h2>
            Remove the unsupported assertion or ground it in approved evidence.
          </h2>
          <p>
            Then rerun all eight synthetic scenarios and every hard release
            gate.
          </p>
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
  return path === "#/failed-case" ? <FailedCase /> : <Comparison />;
}
