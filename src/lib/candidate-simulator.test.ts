import { describe, expect, it } from "vitest";
import { fixtures } from "../data/seed";
import {
  simulatorFixtureBySourceId,
  simulatorFixtures,
} from "../data/simulator-fixtures";
import {
  createCandidateSimulatorState,
  simulateCandidateResponse,
} from "./candidate-simulator";

describe("candidate simulator", () => {
  it("progresses through a normal multi-turn candidate conversation", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const opening = simulateCandidateResponse(
      fixture,
      createCandidateSimulatorState(fixture),
      "open_conversation",
    );
    const followUp = simulateCandidateResponse(
      fixture,
      opening.nextState,
      "ask_relevant_experience",
    );

    expect(opening.result).toMatchObject({
      kind: "response",
      response:
        "I led a team that rebuilt our event pipeline to process 40M events daily.",
    });
    expect(followUp.result).toMatchObject({
      kind: "response",
      answerCompleteness: "complete",
    });
    expect(followUp.nextState).toMatchObject({
      currentStateId: "complete",
      turn: 2,
    });
  });

  it("marks an incomplete backend answer without adding facts", () => {
    const fixture = simulatorFixtureBySourceId("f2");
    const opening = simulateCandidateResponse(
      fixture,
      createCandidateSimulatorState(fixture),
      "open_conversation",
    );
    const answer = simulateCandidateResponse(
      fixture,
      opening.nextState,
      "ask_backend_ownership",
    );

    expect(answer.result).toMatchObject({
      kind: "response",
      answerCompleteness: "incomplete",
      response: expect.stringContaining("have not owned a backend service"),
    });
  });

  it("surfaces accommodation escalation conditions", () => {
    const fixture = simulatorFixtureBySourceId("f4");
    const step = simulateCandidateResponse(
      fixture,
      createCandidateSimulatorState(fixture),
      "open_conversation",
    );

    expect(step.result).toMatchObject({
      kind: "response",
      escalationConditions: [{ requiredAction: "route_to_recruiting" }],
    });
  });

  it("returns a typed fallback for unsupported interviewer intents", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const step = simulateCandidateResponse(
      fixture,
      createCandidateSimulatorState(fixture),
      "ask_role_fit",
    );

    expect(step.result).toEqual({
      kind: "fallback",
      reason: "unsupported_intent",
      response:
        "I don't have information in this synthetic scenario to answer that question.",
      supportedIntents: ["open_conversation"],
    });
    expect(step.nextState).toEqual(createCandidateSimulatorState(fixture));
  });

  it("returns a typed fallback for ambiguous interviewer intents", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const step = simulateCandidateResponse(
      fixture,
      createCandidateSimulatorState(fixture),
      "ambiguous",
    );

    expect(step.result).toEqual({
      kind: "fallback",
      reason: "ambiguous_intent",
      response:
        "I don't have information in this synthetic scenario to answer that question.",
      supportedIntents: ["open_conversation"],
    });
  });

  it("keeps paired-case metadata on both controlled fixtures", () => {
    const first = simulatorFixtureBySourceId("f6");
    const second = simulatorFixtureBySourceId("f7");
    const firstStep = simulateCandidateResponse(
      first,
      createCandidateSimulatorState(first),
      "open_conversation",
    );
    const secondStep = simulateCandidateResponse(
      second,
      createCandidateSimulatorState(second),
      "open_conversation",
    );

    expect(firstStep.result).toMatchObject({
      kind: "response",
      pairedCase: { pairId: "api-ownership", variant: "A" },
    });
    expect(secondStep.result).toMatchObject({
      kind: "response",
      pairedCase: { pairId: "api-ownership", variant: "B" },
    });
  });

  it("is deterministic for repeated execution from the same state", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const state = createCandidateSimulatorState(fixture);

    expect(
      simulateCandidateResponse(fixture, state, "open_conversation"),
    ).toEqual(simulateCandidateResponse(fixture, state, "open_conversation"));
  });

  it("keeps every simulator fixture structurally aligned with the seeded scenarios", () => {
    expect(simulatorFixtures).toHaveLength(fixtures.length);
    expect(
      new Set(simulatorFixtures.map((fixture) => fixture.sourceFixtureId)),
    ).toHaveLength(fixtures.length);

    for (const seededFixture of fixtures) {
      const fixture = simulatorFixtureBySourceId(seededFixture.id);
      const stateIds = new Set(
        fixture.conversationStates.map((state) => state.id),
      );
      const opening = fixture.conversationStates.find(
        (state) => state.id === fixture.initialStateId,
      );

      expect(opening).toBeDefined();
      expect(
        opening?.allowedInterviewerIntentTransitions.length,
      ).toBeGreaterThan(0);

      for (const state of fixture.conversationStates) {
        for (const transition of state.allowedInterviewerIntentTransitions) {
          expect(stateIds.has(transition.nextStateId)).toBe(true);
          for (const evidence of transition.expectedEvidenceSpans) {
            expect(transition.response).toContain(evidence.text);
          }
          for (const escalation of transition.escalationConditions) {
            expect(escalation.id).not.toBe("");
            expect(escalation.trigger).not.toBe("");
            expect([
              "route_to_recruiting",
              "avoid_outcome_assurance",
            ]).toContain(escalation.requiredAction);
          }
        }
      }

      if (seededFixture.pairedCaseId) {
        expect(fixture.pairedCase).toMatchObject({
          pairId: seededFixture.pairedCaseId,
        });
      } else {
        expect(fixture.pairedCase).toBeUndefined();
      }
    }

    const pairedFixtures = simulatorFixtures.filter(
      (fixture) => fixture.pairedCase,
    );
    expect(pairedFixtures).toHaveLength(2);
    expect(
      new Set(pairedFixtures.map((fixture) => fixture.pairedCase?.pairId)),
    ).toEqual(new Set(["api-ownership"]));
    expect(
      new Set(pairedFixtures.map((fixture) => fixture.pairedCase?.variant)),
    ).toEqual(new Set(["A", "B"]));
  });
});
