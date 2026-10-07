export type Id = string;
export type ReleaseStatus = "draft" | "ready" | "blocked";
export type RunOutcome = "advance" | "decline" | "escalate";
export type CheckStatus = "pass" | "fail";
export type ReleaseCheckClassification =
  | "deterministic_hard_gate"
  | "human_reviewed_hard_gate"
  | "review_required"
  | "informational";
export type GateKind =
  | "unsupported_claim"
  | "citation_resolution"
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
  classification: ReleaseCheckClassification;
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

export type ScreeningRunState =
  "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ScreeningRunRequest {
  id: Id;
  configurationId: Id;
  fixtureId: Id;
  adapterId: Id;
}

export interface ScreeningRunContext {
  request: ScreeningRunRequest;
  fixture: CandidateSimulationFixture;
  simulatorState: CandidateSimulatorState;
  turns: ScreeningRunTurn[];
}

export interface AgentClaim {
  claim: string;
  reference: ClaimSupportReference;
  turn: number;
}

export type ScreeningAgentDecision =
  | {
      kind: "intent";
      intent: InterviewerIntent | string;
      escalationResults?: EscalationCondition[];
      claim?: Omit<AgentClaim, "turn">;
    }
  | { kind: "complete" }
  | { kind: "failure"; message: string };

export interface ScreeningAgentAdapter {
  id: Id;
  nextIntent(context: ScreeningRunContext): ScreeningAgentDecision;
}

export interface ScreeningRunTurn {
  sequence: number;
  interviewerIntent: string;
  candidateResponse: string;
  resultKind: CandidateSimulationResult["kind"];
  evidenceExcerpts: ExpectedEvidenceSpan[];
  escalationResults: EscalationCondition[];
  agentClaims: AgentClaim[];
  fallbackReason?: CandidateFallbackResult["reason"];
}

export type ScreeningRunFailureCode =
  | "fixture_mismatch"
  | "adapter_identity_mismatch"
  | "invalid_interviewer_transition"
  | "unsupported_intent"
  | "adapter_failure";

export interface ScreeningRunFailure {
  code: ScreeningRunFailureCode;
  message: string;
  turn: number;
}

export interface ScreeningRunResult {
  request: ScreeningRunRequest;
  configurationId: Id;
  fixtureId: Id;
  adapterId: Id;
  state: ScreeningRunState;
  stateHistory: ScreeningRunState[];
  interviewerIntents: string[];
  candidateResponses: string[];
  evidenceExcerpts: ExpectedEvidenceSpan[];
  escalationResults: EscalationCondition[];
  agentClaims: AgentClaim[];
  turns: ScreeningRunTurn[];
  terminalOutcome: "completed" | "failed" | "cancelled";
  completionReason?: "adapter_completed" | "conversation_exhausted";
  failure?: ScreeningRunFailure;
}

export type EvaluatorType =
  | "citation_resolution"
  | "claim_support"
  | "escalation_correctness"
  | "paired_case_consistency";

export type EvaluatorStatus = "pass" | "fail" | "review" | "not_applicable";

export interface EvidenceReference {
  id: Id;
  label: string;
  source: string;
  excerpt?: string;
  turn?: number;
  range?: { start: number; end: number };
}

export interface EvaluatorFailureDetail {
  code: string;
  message: string;
}

export interface EvaluatorResultBase {
  evaluatorType: EvaluatorType;
  status: EvaluatorStatus;
  fixtureId: Id;
  runId: Id;
  evidenceReferences: EvidenceReference[];
  failureDetails?: EvaluatorFailureDetail[];
  limitations: string[];
  evaluatorVersion: string;
}

export type CitationResolution =
  | { kind: "resolved"; range: { start: number; end: number } }
  | { kind: "missing" }
  | { kind: "ambiguous"; occurrences: number };

export interface CitationResolutionResult extends EvaluatorResultBase {
  evaluatorType: "citation_resolution";
  resolution: CitationResolution;
}

export interface ClaimSupportReference {
  label: string;
  source: string;
  limitation: string;
  supportsClaim: boolean;
}

export interface ClaimSupportResult extends EvaluatorResultBase {
  evaluatorType: "claim_support";
  claim: string;
  reference: ClaimSupportReference;
  supportedByReference: boolean;
}

export type EscalationOutcome =
  | "correct_escalation"
  | "missed_escalation"
  | "unexpected_escalation"
  | "not_applicable";

export interface EscalationCorrectnessResult extends EvaluatorResultBase {
  evaluatorType: "escalation_correctness";
  outcome: EscalationOutcome;
}

export interface PairedCaseConsistencyResult extends EvaluatorResultBase {
  evaluatorType: "paired_case_consistency";
  pairId?: Id;
  invariant?: string;
  comparedFixtureId?: Id;
  comparedRunId?: Id;
  reviewRequired: boolean;
}
