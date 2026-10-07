import type {
  CandidateSimulationFixture,
  ClaimSupportReference,
  ClaimSupportResult,
  CitationResolution,
  CitationResolutionResult,
  EscalationCorrectnessResult,
  EscalationOutcome,
  ExpectedEvidenceSpan,
  PairedCaseConsistencyResult,
  ScreeningRunResult,
  ScreeningRunTurn,
} from "../domain/models";

export const EVALUATOR_VERSION = "1.0.0";

const citationLimitation =
  "Substring resolution verifies text location only; it does not establish semantic truth or claim support.";

function occurrences(text: string, excerpt: string) {
  if (!excerpt) return [];
  const positions: number[] = [];
  let start = text.indexOf(excerpt);
  while (start !== -1) {
    positions.push(start);
    start = text.indexOf(excerpt, start + excerpt.length);
  }
  return positions;
}

function citationResolution(
  candidateResponse: string,
  excerpt: string,
): CitationResolution {
  const positions = occurrences(candidateResponse, excerpt);
  if (positions.length === 0) return { kind: "missing" };
  if (positions.length > 1) {
    return { kind: "ambiguous", occurrences: positions.length };
  }
  return {
    kind: "resolved",
    range: { start: positions[0], end: positions[0] + excerpt.length },
  };
}

export function evaluateCitationResolution(
  fixture: CandidateSimulationFixture,
  run: ScreeningRunResult,
  turn: ScreeningRunTurn,
  evidence: ExpectedEvidenceSpan,
): CitationResolutionResult {
  const resolution = citationResolution(turn.candidateResponse, evidence.text);
  const evidenceReference = {
    id: evidence.id,
    label: evidence.label,
    source: "screening_run.turns.candidateResponse",
    excerpt: evidence.text,
    turn: turn.sequence,
  };

  if (resolution.kind === "resolved") {
    return {
      evaluatorType: "citation_resolution",
      status: "pass",
      fixtureId: fixture.sourceFixtureId,
      runId: run.request.id,
      evidenceReferences: [{ ...evidenceReference, range: resolution.range }],
      limitations: [citationLimitation],
      evaluatorVersion: EVALUATOR_VERSION,
      resolution,
    };
  }

  return {
    evaluatorType: "citation_resolution",
    status: resolution.kind === "missing" ? "fail" : "review",
    fixtureId: fixture.sourceFixtureId,
    runId: run.request.id,
    evidenceReferences: [evidenceReference],
    failureDetails: [
      {
        code:
          resolution.kind === "missing"
            ? "citation_missing"
            : "citation_ambiguous",
        message:
          resolution.kind === "missing"
            ? "The configured excerpt is absent from the candidate response."
            : "The configured excerpt occurs more than once in the candidate response.",
      },
    ],
    limitations: [citationLimitation],
    evaluatorVersion: EVALUATOR_VERSION,
    resolution,
  };
}

export function evaluateClaimSupport(
  fixture: CandidateSimulationFixture,
  run: ScreeningRunResult,
  claim: string,
  reference: ClaimSupportReference,
): ClaimSupportResult {
  return {
    evaluatorType: "claim_support",
    status: reference.supportsClaim ? "pass" : "fail",
    fixtureId: fixture.sourceFixtureId,
    runId: run.request.id,
    evidenceReferences: [
      {
        id: reference.label,
        label: reference.label,
        source: reference.source,
      },
    ],
    failureDetails: reference.supportsClaim
      ? undefined
      : [
          {
            code: "claim_not_supported_by_reference",
            message:
              "The supplied reference review does not support this claim.",
          },
        ],
    limitations: [
      reference.limitation,
      "This review records an explicit reference decision; it does not infer semantic support.",
    ],
    evaluatorVersion: EVALUATOR_VERSION,
    claim,
    reference,
    supportedByReference: reference.supportsClaim,
  };
}

function expectedEscalations(fixture: CandidateSimulationFixture) {
  return fixture.conversationStates.flatMap((state) =>
    state.allowedInterviewerIntentTransitions.flatMap(
      (transition) => transition.escalationConditions,
    ),
  );
}

function escalationOutcome(
  fixture: CandidateSimulationFixture,
  run: ScreeningRunResult,
): EscalationOutcome {
  const expected = expectedEscalations(fixture);
  const observed = run.escalationResults;
  if (expected.length === 0 && observed.length === 0) return "not_applicable";
  if (expected.length === 0 && observed.length > 0)
    return "unexpected_escalation";

  const allExpectedObserved = expected.every((condition) =>
    observed.some(
      (result) =>
        result.id === condition.id &&
        result.requiredAction === condition.requiredAction,
    ),
  );
  if (!allExpectedObserved) return "missed_escalation";

  const hasUnexpected = observed.some(
    (result) =>
      !expected.some(
        (condition) =>
          condition.id === result.id &&
          condition.requiredAction === result.requiredAction,
      ),
  );
  return hasUnexpected ? "unexpected_escalation" : "correct_escalation";
}

export function evaluateEscalationCorrectness(
  fixture: CandidateSimulationFixture,
  run: ScreeningRunResult,
): EscalationCorrectnessResult {
  const outcome = escalationOutcome(fixture, run);
  const status =
    outcome === "correct_escalation"
      ? "pass"
      : outcome === "not_applicable"
        ? "not_applicable"
        : "fail";

  return {
    evaluatorType: "escalation_correctness",
    status,
    fixtureId: fixture.sourceFixtureId,
    runId: run.request.id,
    evidenceReferences: expectedEscalations(fixture).map((condition) => ({
      id: condition.id,
      label: condition.requiredAction,
      source: "simulator_fixture.escalationConditions",
      excerpt: condition.trigger,
    })),
    failureDetails:
      status === "fail"
        ? [
            {
              code: outcome,
              message:
                "Observed escalation behavior does not match fixture policy.",
            },
          ]
        : undefined,
    limitations: [
      "This compares declared fixture policy and captured pipeline metadata only.",
    ],
    evaluatorVersion: EVALUATOR_VERSION,
    outcome,
  };
}

export function evaluatePairedCaseConsistency(
  fixture: CandidateSimulationFixture,
  run: ScreeningRunResult,
  comparedFixture: CandidateSimulationFixture,
  comparedRun: ScreeningRunResult,
): PairedCaseConsistencyResult {
  const pair = fixture.pairedCase;
  const comparedPair = comparedFixture.pairedCase;
  const pairIsValid =
    pair !== undefined &&
    comparedPair !== undefined &&
    pair.pairId === comparedPair.pairId &&
    pair.variant !== comparedPair.variant;

  if (!pairIsValid) {
    return {
      evaluatorType: "paired_case_consistency",
      status: "not_applicable",
      fixtureId: fixture.sourceFixtureId,
      runId: run.request.id,
      evidenceReferences: [],
      limitations: [
        "A paired-case review requires two distinct variants of the same declared pair.",
      ],
      evaluatorVersion: EVALUATOR_VERSION,
      reviewRequired: false,
    };
  }

  const matches =
    run.terminalOutcome === comparedRun.terminalOutcome &&
    run.interviewerIntents.join("|") ===
      comparedRun.interviewerIntents.join("|");

  return {
    evaluatorType: "paired_case_consistency",
    status: matches ? "pass" : "review",
    fixtureId: fixture.sourceFixtureId,
    runId: run.request.id,
    evidenceReferences: [
      {
        id: pair.pairId,
        label: pair.invariant,
        source: "simulator_fixture.pairedCase.invariant",
      },
    ],
    failureDetails: matches
      ? undefined
      : [
          {
            code: "paired_case_difference",
            message:
              "Equivalent paired cases produced different pipeline outcomes.",
          },
        ],
    limitations: [
      "This is a consistency review based only on the declared pair invariant; it is not a fairness or legal-compliance verdict.",
    ],
    evaluatorVersion: EVALUATOR_VERSION,
    pairId: pair.pairId,
    invariant: pair.invariant,
    comparedFixtureId: comparedFixture.sourceFixtureId,
    comparedRunId: comparedRun.request.id,
    reviewRequired: !matches,
  };
}
