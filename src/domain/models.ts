export type Id = string;
export type ReleaseStatus = "draft" | "ready" | "blocked";
export type RunOutcome = "advance" | "decline" | "escalate";
export type CheckStatus = "pass" | "fail";
export type GateKind =
  | "unsupported_claim"
  | "missed_escalation"
  | "paired_consistency"
  | "aggregate_agreement";

export interface Role {
  id: Id;
  title: string;
  level: string;
  focusAreas: string[];
}

export interface Release {
  id: Id;
  roleId: Id;
  name: string;
  version: string;
  status: ReleaseStatus;
  createdAt: string;
}

export interface Fixture {
  id: Id;
  roleId: Id;
  title: string;
  summary: string;
  category: string;
  candidateMessage: string;
  approvedFacts: string[];
  expectedBehavior: string;
  pairedCaseId?: string;
}

export interface Run {
  id: Id;
  releaseId: Id;
  fixtureId: Id;
  outcome: RunOutcome;
  response: string;
  completedAt: string;
}

export interface Evidence {
  id: Id;
  runId: Id;
  kind: "model_response" | "fixture_fact" | "comparison_note";
  label: string;
  excerpt: string;
}

export interface Check {
  id: Id;
  releaseId: Id;
  kind: GateKind;
  title: string;
  fixtureIds: Id[];
  status: CheckStatus;
  isHardGate: boolean;
  rationale: string;
  evidenceIds: Id[];
}

export interface ReleaseEvaluation {
  releaseId: Id;
  baselineReleaseId: Id;
  aggregateAgreement: {
    matchedFixtures: number;
    totalFixtures: number;
    percentage: number;
  };
  checks: Check[];
  status: ReleaseStatus;
}
