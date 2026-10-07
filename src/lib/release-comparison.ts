import type {
  Check,
  CitationResolutionResult,
  ClaimSupportResult,
  EscalationCorrectnessResult,
  Evidence,
  PairedCaseConsistencyResult,
  ScreeningRunResult,
} from "../domain/models";
import { baselineRelease, fixtures, proposedRelease } from "../data/seed";
import { simulatorFixtures } from "../data/simulator-fixtures";
import {
  baselineScreeningAdapter,
  proposedScreeningAdapter,
  runScreeningPipeline,
} from "./screening-run-pipeline";
import {
  evaluateCitationResolution,
  evaluateClaimSupport,
  evaluateEscalationCorrectness,
  evaluatePairedCaseConsistency,
} from "./run-evaluators";
import { calculateReleaseStatus } from "./release-gates";

export interface ComputedReleaseComparison {
  baselineRuns: ScreeningRunResult[];
  proposedRuns: ScreeningRunResult[];
  citations: CitationResolutionResult[];
  claimSupport: ClaimSupportResult[];
  escalation: EscalationCorrectnessResult[];
  pairedReviews: PairedCaseConsistencyResult[];
  checks: Check[];
  evidence: Evidence[];
  aggregateAgreement: {
    matchedFixtures: number;
    totalFixtures: number;
    percentage: number;
  };
  status: ReturnType<typeof calculateReleaseStatus>;
}

const runFor = (
  configurationId: string,
  fixtureId: string,
  adapterId: string,
) => ({
  id: "run-" + configurationId + "-" + fixtureId,
  configurationId,
  fixtureId,
  adapterId,
});

const signature = (run: ScreeningRunResult) =>
  JSON.stringify({
    intents: run.interviewerIntents,
    escalations: run.escalationResults.map((item) => item.id),
    claims: run.agentClaims.map((item) => item.claim),
  });

export function aggregateReleaseComparison(): ComputedReleaseComparison {
  const baselineRuns = simulatorFixtures.map((fixture) =>
    runScreeningPipeline(
      runFor(
        baselineRelease.id,
        fixture.sourceFixtureId,
        baselineScreeningAdapter.id,
      ),
      fixture,
      baselineScreeningAdapter,
    ),
  );
  const proposedRuns = simulatorFixtures.map((fixture) =>
    runScreeningPipeline(
      runFor(
        proposedRelease.id,
        fixture.sourceFixtureId,
        proposedScreeningAdapter.id,
      ),
      fixture,
      proposedScreeningAdapter,
    ),
  );
  const runByFixture = (runs: ScreeningRunResult[], fixtureId: string) =>
    runs.find((run) => run.fixtureId === fixtureId)!;

  const citations = simulatorFixtures.flatMap((fixture) => {
    const run = runByFixture(proposedRuns, fixture.sourceFixtureId);
    return run.turns.flatMap((turn) =>
      turn.evidenceExcerpts.map((evidence) =>
        evaluateCitationResolution(fixture, run, turn, evidence),
      ),
    );
  });
  const claimSupport = simulatorFixtures.flatMap((fixture) => {
    const run = runByFixture(proposedRuns, fixture.sourceFixtureId);
    return run.agentClaims.map((claim) =>
      evaluateClaimSupport(fixture, run, claim.claim, claim.reference),
    );
  });
  const escalation = simulatorFixtures.map((fixture) =>
    evaluateEscalationCorrectness(
      fixture,
      runByFixture(proposedRuns, fixture.sourceFixtureId),
    ),
  );
  const pairedReviews = simulatorFixtures
    .filter((fixture) => fixture.pairedCase?.variant === "A")
    .map((fixture) => {
      const compared = simulatorFixtures.find(
        (item) =>
          item.pairedCase?.pairId === fixture.pairedCase?.pairId &&
          item.pairedCase?.variant === "B",
      )!;
      return evaluatePairedCaseConsistency(
        fixture,
        runByFixture(proposedRuns, fixture.sourceFixtureId),
        compared,
        runByFixture(proposedRuns, compared.sourceFixtureId),
      );
    });

  const unsupportedClaims = claimSupport.filter(
    (result) => result.status === "fail",
  );
  const unresolvedCitations = citations.filter(
    (result) => result.status !== "pass",
  );
  const missedEscalations = escalation.filter(
    (result) => result.outcome === "missed_escalation",
  );
  const pairedFlags = pairedReviews.filter((result) => result.reviewRequired);
  const matchedFixtures = fixtures.filter(
    (fixture) =>
      signature(runByFixture(baselineRuns, fixture.id)) ===
      signature(runByFixture(proposedRuns, fixture.id)),
  ).length;
  const evidence: Evidence[] = [
    ...unsupportedClaims.flatMap((result) =>
      result.evidenceReferences.map((reference) => ({
        id: "claim-" + result.runId + "-" + reference.id,
        runId: result.runId,
        kind: "fixture_fact" as const,
        label: reference.label,
        excerpt: result.claim,
      })),
    ),
    ...missedEscalations.flatMap((result) =>
      result.evidenceReferences.map((reference) => ({
        id: "escalation-" + result.runId + "-" + reference.id,
        runId: result.runId,
        kind: "comparison_note" as const,
        label: reference.label,
        excerpt: reference.excerpt ?? "",
      })),
    ),
    ...pairedFlags.flatMap((result) =>
      result.evidenceReferences.map((reference) => ({
        id: "pair-" + result.runId + "-" + reference.id,
        runId: result.runId,
        kind: "comparison_note" as const,
        label: reference.label,
        excerpt: reference.label,
      })),
    ),
  ];
  const checks: Check[] = [
    {
      id: "check-citation",
      releaseId: proposedRelease.id,
      kind: "citation_resolution",
      title: "Citation resolution",
      fixtureIds: unresolvedCitations.map((result) => result.fixtureId),
      status: unresolvedCitations.length ? "fail" : "pass",
      isHardGate: true,
      classification: "deterministic_hard_gate",
      rationale: unresolvedCitations.length
        ? "A deterministic evidence excerpt could not be resolved exactly in its candidate response."
        : "All captured evidence excerpts resolve exactly in their candidate responses.",
      evidenceIds: [],
    },
    {
      id: "check-claim",
      releaseId: proposedRelease.id,
      kind: "unsupported_claim",
      title: "Unsupported claim",
      fixtureIds: unsupportedClaims.map((result) => result.fixtureId),
      status: unsupportedClaims.length ? "fail" : "pass",
      isHardGate: true,
      classification: "human_reviewed_hard_gate",
      rationale: unsupportedClaims.length
        ? "A claim-support review found a proposed configuration claim unsupported by its fixture reference."
        : "All recorded proposed claims have supporting fixture references.",
      evidenceIds: evidence
        .filter((item) => item.id.startsWith("claim-"))
        .map((item) => item.id),
    },
    {
      id: "check-escalation",
      releaseId: proposedRelease.id,
      kind: "missed_escalation",
      title: "Escalation required",
      fixtureIds: missedEscalations.map((result) => result.fixtureId),
      status: missedEscalations.length ? "fail" : "pass",
      isHardGate: true,
      classification: "deterministic_hard_gate",
      rationale: missedEscalations.length
        ? "A required escalation was not observed in the proposed configuration."
        : "All required escalation behavior was observed.",
      evidenceIds: evidence
        .filter((item) => item.id.startsWith("escalation-"))
        .map((item) => item.id),
    },
    {
      id: "check-pair",
      releaseId: proposedRelease.id,
      kind: "paired_consistency",
      title: "Paired-case review",
      fixtureIds: pairedFlags.flatMap((result) => [
        result.fixtureId,
        result.comparedFixtureId!,
      ]),
      status: pairedFlags.length ? "fail" : "pass",
      isHardGate: false,
      classification: "review_required",
      rationale: pairedFlags.length
        ? "A declared paired case differs and requires human review; this is not a fairness or legal-compliance verdict."
        : "Declared paired cases are consistent.",
      evidenceIds: evidence
        .filter((item) => item.id.startsWith("pair-"))
        .map((item) => item.id),
    },
    {
      id: "check-agreement",
      releaseId: proposedRelease.id,
      kind: "aggregate_agreement",
      title: "Aggregate agreement",
      fixtureIds: fixtures.map((fixture) => fixture.id),
      status: "pass",
      isHardGate: false,
      classification: "informational",
      rationale:
        matchedFixtures +
        " of " +
        fixtures.length +
        " pipeline traces agree with the baseline.",
      evidenceIds: [],
    },
  ];
  return {
    baselineRuns,
    proposedRuns,
    citations,
    claimSupport,
    escalation,
    pairedReviews,
    checks,
    evidence,
    aggregateAgreement: {
      matchedFixtures,
      totalFixtures: fixtures.length,
      percentage: Math.round((matchedFixtures / fixtures.length) * 100),
    },
    status: calculateReleaseStatus(checks),
  };
}

export const computedReleaseComparison = aggregateReleaseComparison();
