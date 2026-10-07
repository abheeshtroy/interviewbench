import type {
  CandidateSimulationFixture,
  CandidateSimulationResult,
  CandidateSimulatorState,
  ScreeningAgentAdapter,
  ScreeningRunContext,
  ScreeningRunFailure,
  ScreeningRunRequest,
  ScreeningRunResult,
  ScreeningRunState,
  ScreeningRunTurn,
} from "../domain/models";
import {
  createCandidateSimulatorState,
  simulateCandidateResponse,
} from "./candidate-simulator";

export interface ScreeningRunOptions {
  cancelAfterTurns?: number;
}

function contextFor(
  request: ScreeningRunRequest,
  fixture: CandidateSimulationFixture,
  simulatorState: CandidateSimulatorState,
  turns: ScreeningRunTurn[],
): ScreeningRunContext {
  return { request, fixture, simulatorState, turns };
}

function terminalResult(
  request: ScreeningRunRequest,
  state: Extract<ScreeningRunState, "completed" | "failed" | "cancelled">,
  stateHistory: ScreeningRunState[],
  turns: ScreeningRunTurn[],
  completionReason?: ScreeningRunResult["completionReason"],
  failure?: ScreeningRunFailure,
): ScreeningRunResult {
  return {
    request,
    configurationId: request.configurationId,
    fixtureId: request.fixtureId,
    adapterId: request.adapterId,
    state,
    stateHistory,
    interviewerIntents: turns.map((turn) => turn.interviewerIntent),
    candidateResponses: turns.map((turn) => turn.candidateResponse),
    evidenceExcerpts: turns.flatMap((turn) => turn.evidenceExcerpts),
    escalationResults: turns.flatMap((turn) => turn.escalationResults),
    turns,
    terminalOutcome: state,
    completionReason,
    failure,
  };
}

function failureResult(
  request: ScreeningRunRequest,
  stateHistory: ScreeningRunState[],
  turns: ScreeningRunTurn[],
  failure: ScreeningRunFailure,
): ScreeningRunResult {
  return terminalResult(
    request,
    "failed",
    stateHistory,
    turns,
    undefined,
    failure,
  );
}

function turnFor(
  sequence: number,
  interviewerIntent: string,
  result: CandidateSimulationResult,
): ScreeningRunTurn {
  if (result.kind === "response") {
    return {
      sequence,
      interviewerIntent,
      candidateResponse: result.response,
      resultKind: result.kind,
      evidenceExcerpts: result.expectedEvidenceSpans,
      escalationResults: result.escalationConditions,
    };
  }

  return {
    sequence,
    interviewerIntent,
    candidateResponse: result.response,
    resultKind: result.kind,
    evidenceExcerpts: [],
    escalationResults: [],
    fallbackReason: result.reason,
  };
}

function isConversationExhausted(
  fixture: CandidateSimulationFixture,
  state: CandidateSimulatorState,
) {
  const currentState = fixture.conversationStates.find(
    (candidateState) => candidateState.id === state.currentStateId,
  );
  return (
    currentState !== undefined &&
    currentState.allowedInterviewerIntentTransitions.length === 0
  );
}

export function runScreeningPipeline(
  request: ScreeningRunRequest,
  fixture: CandidateSimulationFixture,
  adapter: ScreeningAgentAdapter,
  options: ScreeningRunOptions = {},
): ScreeningRunResult {
  const queued: ScreeningRunState[] = ["queued"];

  if (request.fixtureId !== fixture.sourceFixtureId) {
    return failureResult(request, [...queued, "failed"], [], {
      code: "fixture_mismatch",
      message:
        "The request fixture does not match the supplied simulator fixture.",
      turn: 0,
    });
  }

  if (request.adapterId !== adapter.id) {
    return failureResult(request, [...queued, "failed"], [], {
      code: "adapter_identity_mismatch",
      message: "The request adapter does not match the supplied adapter.",
      turn: 0,
    });
  }

  const stateHistory: ScreeningRunState[] = [...queued, "running"];
  let simulatorState = createCandidateSimulatorState(fixture);
  let turns: ScreeningRunTurn[] = [];

  while (true) {
    if (
      options.cancelAfterTurns !== undefined &&
      turns.length >= options.cancelAfterTurns
    ) {
      return terminalResult(
        request,
        "cancelled",
        [...stateHistory, "cancelled"],
        turns,
      );
    }

    if (isConversationExhausted(fixture, simulatorState)) {
      return terminalResult(
        request,
        "completed",
        [...stateHistory, "completed"],
        turns,
        "conversation_exhausted",
      );
    }

    let decision;
    try {
      decision = adapter.nextIntent(
        contextFor(request, fixture, simulatorState, turns),
      );
    } catch (error) {
      return failureResult(request, [...stateHistory, "failed"], turns, {
        code: "adapter_failure",
        message: error instanceof Error ? error.message : "Adapter failed.",
        turn: turns.length,
      });
    }

    if (decision.kind === "failure") {
      return failureResult(request, [...stateHistory, "failed"], turns, {
        code: "adapter_failure",
        message: decision.message,
        turn: turns.length,
      });
    }

    if (decision.kind === "complete") {
      return terminalResult(
        request,
        "completed",
        [...stateHistory, "completed"],
        turns,
        "adapter_completed",
      );
    }

    const step = simulateCandidateResponse(
      fixture,
      simulatorState,
      decision.intent,
    );
    const turn = turnFor(turns.length + 1, decision.intent, step.result);
    turns = [...turns, turn];

    if (step.result.kind === "fallback") {
      return failureResult(request, [...stateHistory, "failed"], turns, {
        code:
          step.result.reason === "invalid_state"
            ? "invalid_interviewer_transition"
            : "unsupported_intent",
        message: step.result.response,
        turn: turn.sequence,
      });
    }

    simulatorState = step.nextState;
  }
}

function deterministicNextIntent(
  context: ScreeningRunContext,
): ReturnType<ScreeningAgentAdapter["nextIntent"]> {
  const currentState = context.fixture.conversationStates.find(
    (state) => state.id === context.simulatorState.currentStateId,
  );
  const transition = currentState?.allowedInterviewerIntentTransitions[0];
  return transition
    ? { kind: "intent", intent: transition.intent }
    : { kind: "complete" };
}

export const baselineScreeningAdapter: ScreeningAgentAdapter = {
  id: "baseline-local",
  nextIntent: deterministicNextIntent,
};

export const proposedScreeningAdapter: ScreeningAgentAdapter = {
  id: "proposed-local",
  nextIntent: deterministicNextIntent,
};
