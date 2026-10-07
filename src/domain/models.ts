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

export type InterviewerIntent =
  | "open_conversation"
  | "ask_relevant_experience"
  | "ask_backend_ownership"
  | "confirm_compensation_question"
  | "ask_accommodation_details"
  | "ask_background_check_question"
  | "ask_role_fit";

export type AnswerCompleteness = "complete" | "incomplete" | "not_applicable";

export interface CandidateIdentity {
  id: Id;
  displayName: string;
  pronouns: string;
  isSynthetic: true;
}

export interface CandidateRoleContext {
  roleId: Id;
  roleTitle: string;
  roleLevel: string;
}

export interface ExpectedEvidenceSpan {
  id: Id;
  text: string;
  label: string;
}

export interface EscalationCondition {
  id: Id;
  trigger: string;
  requiredAction: "route_to_recruiting" | "avoid_outcome_assurance";
}

export interface PairedCaseMetadata {
  pairId: Id;
  variant: "A" | "B";
  invariant: string;
}

export interface CandidateIntentTransition {
  intent: InterviewerIntent;
  response: string;
  nextStateId: Id;
  expectedEvidenceSpans: ExpectedEvidenceSpan[];
  answerCompleteness: AnswerCompleteness;
  escalationConditions: EscalationCondition[];
}

export interface CandidateConversationState {
  id: Id;
  allowedInterviewerIntentTransitions: CandidateIntentTransition[];
}

export interface CandidateSimulationFixture {
  id: Id;
  sourceFixtureId: Id;
  candidate: CandidateIdentity;
  roleContext: CandidateRoleContext;
  initialStateId: Id;
  conversationStates: CandidateConversationState[];
  pairedCase?: PairedCaseMetadata;
}

export interface CandidateSimulatorState {
  fixtureId: Id;
  currentStateId: Id;
  turn: number;
}

export interface CandidateResponseResult {
  kind: "response";
  response: string;
  expectedEvidenceSpans: ExpectedEvidenceSpan[];
  escalationConditions: EscalationCondition[];
  answerCompleteness: AnswerCompleteness;
  pairedCase?: PairedCaseMetadata;
}

export interface CandidateFallbackResult {
  kind: "fallback";
  reason: "ambiguous_intent" | "unsupported_intent" | "invalid_state";
  response: string;
  supportedIntents: InterviewerIntent[];
}

export type CandidateSimulationResult =
  CandidateResponseResult | CandidateFallbackResult;

export interface CandidateSimulationStep {
  result: CandidateSimulationResult;
  nextState: CandidateSimulatorState;
}
