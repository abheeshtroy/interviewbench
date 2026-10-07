import type {
  CandidateSimulationFixture,
  CandidateSimulationStep,
  CandidateSimulatorState,
  InterviewerIntent,
} from "../domain/models";

const fallbackResponse =
  "I don't have information in this synthetic scenario to answer that question.";

export function createCandidateSimulatorState(
  fixture: CandidateSimulationFixture,
): CandidateSimulatorState {
  return {
    fixtureId: fixture.id,
    currentStateId: fixture.initialStateId,
    turn: 0,
  };
}

export function simulateCandidateResponse(
  fixture: CandidateSimulationFixture,
  state: CandidateSimulatorState,
  interviewerIntent: InterviewerIntent | string,
): CandidateSimulationStep {
  const currentState = fixture.conversationStates.find(
    (conversationState) =>
      conversationState.id === state.currentStateId &&
      state.fixtureId === fixture.id,
  );

  if (!currentState) {
    return {
      result: {
        kind: "fallback",
        reason: "invalid_state",
        response: fallbackResponse,
        supportedIntents: [],
      },
      nextState: state,
    };
  }

  const transition = currentState.allowedInterviewerIntentTransitions.find(
    (candidateTransition) => candidateTransition.intent === interviewerIntent,
  );

  if (!transition) {
    const supportedIntents =
      currentState.allowedInterviewerIntentTransitions.map(
        (candidateTransition) => candidateTransition.intent,
      );
    return {
      result: {
        kind: "fallback",
        reason:
          interviewerIntent === "" || interviewerIntent === "ambiguous"
            ? "ambiguous_intent"
            : "unsupported_intent",
        response: fallbackResponse,
        supportedIntents,
      },
      nextState: state,
    };
  }

  return {
    result: {
      kind: "response",
      response: transition.response,
      expectedEvidenceSpans: transition.expectedEvidenceSpans,
      escalationConditions: transition.escalationConditions,
      answerCompleteness: transition.answerCompleteness,
      pairedCase: fixture.pairedCase,
    },
    nextState: {
      fixtureId: fixture.id,
      currentStateId: transition.nextStateId,
      turn: state.turn + 1,
    },
  };
}
