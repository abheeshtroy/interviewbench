import { describe, expect, it } from "vitest";
import type { ScreeningRunRequest } from "../domain/models";
import { simulatorFixtureBySourceId } from "../data/simulator-fixtures";
import {
  baselineScreeningAdapter,
  runScreeningPipeline,
} from "./screening-run-pipeline";
import {
  EVALUATOR_VERSION,
  evaluateCitationResolution,
  evaluateClaimSupport,
  evaluateEscalationCorrectness,
  evaluatePairedCaseConsistency,
} from "./run-evaluators";

const request = (fixtureId: string): ScreeningRunRequest => ({
  id: "evaluator-run-" + fixtureId,
  configurationId: "evaluator-configuration",
  fixtureId,
  adapterId: baselineScreeningAdapter.id,
});

const completedRun = (fixtureId: string) => {
  const fixture = simulatorFixtureBySourceId(fixtureId);
  return {
    fixture,
    run: runScreeningPipeline(
      request(fixture.sourceFixtureId),
      fixture,
      baselineScreeningAdapter,
    ),
  };
};

describe("run evaluators", () => {
  it("resolves an exact citation to a half-open character range", () => {
    const { fixture, run } = completedRun("f1");
    const result = evaluateCitationResolution(
      fixture,
      run,
      run.turns[0],
      run.turns[0].evidenceExcerpts[0],
    );

    expect(result).toMatchObject({
      evaluatorType: "citation_resolution",
      status: "pass",
      resolution: {
        kind: "resolved",
        range: { start: 56, end: 72 },
      },
    });
  });

  it("returns a typed missing citation result", () => {
    const { fixture, run } = completedRun("f1");
    const result = evaluateCitationResolution(
      fixture,
      run,
      { ...run.turns[0], candidateResponse: "No matching excerpt." },
      run.turns[0].evidenceExcerpts[0],
    );

    expect(result).toMatchObject({
      status: "fail",
      resolution: { kind: "missing" },
      failureDetails: [{ code: "citation_missing" }],
    });
  });

  it("returns a typed ambiguous citation result", () => {
    const { fixture, run } = completedRun("f1");
    const result = evaluateCitationResolution(
      fixture,
      run,
      {
        ...run.turns[0],
        candidateResponse: "40M events daily; later, 40M events daily again.",
      },
      run.turns[0].evidenceExcerpts[0],
    );

    expect(result).toMatchObject({
      status: "review",
      resolution: { kind: "ambiguous", occurrences: 2 },
      failureDetails: [{ code: "citation_ambiguous" }],
    });
  });

  it("records a claim-support review separately from citation resolution", () => {
    const { fixture, run } = completedRun("f1");
    const result = evaluateClaimSupport(
      fixture,
      run,
      "The candidate has relevant distributed-systems experience.",
      {
        label: fixture.sourceFixtureId + "-approved-fact",
        source: "seed_fixture.approvedFacts",
        limitation:
          "The reference is fixture-authored and not externally verified.",
        supportsClaim: true,
      },
    );

    expect(result).toMatchObject({
      evaluatorType: "claim_support",
      status: "pass",
      supportedByReference: true,
      reference: { source: "seed_fixture.approvedFacts" },
    });
    expect(result.limitations).toContain(
      "The reference is fixture-authored and not externally verified.",
    );
  });

  it("recognizes correct escalation behavior", () => {
    const { fixture, run } = completedRun("f4");

    expect(evaluateEscalationCorrectness(fixture, run)).toMatchObject({
      status: "pass",
      outcome: "correct_escalation",
    });
  });

  it("recognizes missed escalation behavior", () => {
    const { fixture, run } = completedRun("f4");
    const result = evaluateEscalationCorrectness(fixture, {
      ...run,
      escalationResults: [],
    });

    expect(result).toMatchObject({
      status: "fail",
      outcome: "missed_escalation",
    });
  });

  it("recognizes unexpected escalation behavior", () => {
    const { fixture, run } = completedRun("f1");
    const escalation =
      simulatorFixtureBySourceId("f4").conversationStates[0]
        .allowedInterviewerIntentTransitions[0].escalationConditions[0];
    const result = evaluateEscalationCorrectness(fixture, {
      ...run,
      escalationResults: [escalation],
    });

    expect(result).toMatchObject({
      status: "fail",
      outcome: "unexpected_escalation",
    });
  });

  it("reports consistent declared paired cases without using protected attributes", () => {
    const first = completedRun("f6");
    const second = completedRun("f7");
    const result = evaluatePairedCaseConsistency(
      first.fixture,
      first.run,
      second.fixture,
      second.run,
    );

    expect(result).toMatchObject({
      status: "pass",
      pairId: "api-ownership",
      reviewRequired: false,
    });
  });

  it("flags differing paired outcomes for review", () => {
    const first = completedRun("f6");
    const second = completedRun("f7");
    const result = evaluatePairedCaseConsistency(
      first.fixture,
      first.run,
      second.fixture,
      { ...second.run, terminalOutcome: "failed" },
    );

    expect(result).toMatchObject({
      status: "review",
      reviewRequired: true,
      failureDetails: [{ code: "paired_case_difference" }],
    });
  });

  it("records the evaluator version on every result", () => {
    const { fixture, run } = completedRun("f1");
    const result = evaluateCitationResolution(
      fixture,
      run,
      run.turns[0],
      run.turns[0].evidenceExcerpts[0],
    );

    expect(result.evaluatorVersion).toBe(EVALUATOR_VERSION);
  });
});
