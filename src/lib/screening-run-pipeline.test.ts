import { describe, expect, it } from "vitest";
import type {
  CandidateSimulationFixture,
  ScreeningAgentAdapter,
  ScreeningRunRequest,
} from "../domain/models";
import { simulatorFixtureBySourceId } from "../data/simulator-fixtures";
import {
  baselineScreeningAdapter,
  proposedScreeningAdapter,
  runScreeningPipeline,
} from "./screening-run-pipeline";

const request = (
  fixtureId: string,
  adapterId: string,
  configurationId = "configuration-baseline",
): ScreeningRunRequest => ({
  id: "run-" + configurationId + "-" + fixtureId,
  configurationId,
  fixtureId,
  adapterId,
});

describe("screening run pipeline", () => {
  it("completes a successful multi-turn run with captured evidence", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const result = runScreeningPipeline(
      request(fixture.sourceFixtureId, baselineScreeningAdapter.id),
      fixture,
      baselineScreeningAdapter,
    );

    expect(result).toMatchObject({
      state: "completed",
      terminalOutcome: "completed",
      completionReason: "conversation_exhausted",
      interviewerIntents: ["open_conversation", "ask_relevant_experience"],
      candidateResponses: [
        "I led a team that rebuilt our event pipeline to process 40M events daily.",
        "I owned the migration plan, incident reviews, and the service-level objectives for that event pipeline.",
      ],
    });
    expect(result.evidenceExcerpts.map((evidence) => evidence.id)).toEqual([
      "f1-scale",
      "f1-ownership",
    ]);
  });

  it("preserves baseline and proposed configuration identity", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const baseline = runScreeningPipeline(
      request(
        fixture.sourceFixtureId,
        baselineScreeningAdapter.id,
        "configuration-baseline",
      ),
      fixture,
      baselineScreeningAdapter,
    );
    const proposed = runScreeningPipeline(
      request(
        fixture.sourceFixtureId,
        proposedScreeningAdapter.id,
        "configuration-proposed",
      ),
      fixture,
      proposedScreeningAdapter,
    );

    expect(baseline).toMatchObject({
      configurationId: "configuration-baseline",
      adapterId: "baseline-local",
    });
    expect(proposed).toMatchObject({
      configurationId: "configuration-proposed",
      adapterId: "proposed-local",
    });
  });

  it("fails an invalid simulator transition", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const invalidFixture: CandidateSimulationFixture = {
      ...fixture,
      initialStateId: "missing-state",
    };
    const adapter: ScreeningAgentAdapter = {
      id: "invalid-transition",
      nextIntent: () => ({ kind: "intent", intent: "open_conversation" }),
    };

    const result = runScreeningPipeline(
      request(invalidFixture.sourceFixtureId, adapter.id),
      invalidFixture,
      adapter,
    );

    expect(result).toMatchObject({
      state: "failed",
      failure: { code: "invalid_interviewer_transition", turn: 1 },
    });
  });

  it("fails while preserving a typed unsupported-intent fallback", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const adapter: ScreeningAgentAdapter = {
      id: "unsupported-intent",
      nextIntent: () => ({ kind: "intent", intent: "ask_role_fit" }),
    };

    const result = runScreeningPipeline(
      request(fixture.sourceFixtureId, adapter.id),
      fixture,
      adapter,
    );

    expect(result).toMatchObject({
      state: "failed",
      failure: { code: "unsupported_intent", turn: 1 },
      turns: [{ resultKind: "fallback", fallbackReason: "unsupported_intent" }],
    });
  });

  it("completes a naturally exhausted conversation", () => {
    const fixture = simulatorFixtureBySourceId("f3");
    const result = runScreeningPipeline(
      request(fixture.sourceFixtureId, baselineScreeningAdapter.id),
      fixture,
      baselineScreeningAdapter,
    );

    expect(result).toMatchObject({
      state: "completed",
      completionReason: "conversation_exhausted",
      interviewerIntents: ["open_conversation"],
    });
  });

  it("captures adapter failures", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const adapter: ScreeningAgentAdapter = {
      id: "failing-adapter",
      nextIntent: () => {
        throw new Error("local adapter unavailable");
      },
    };

    const result = runScreeningPipeline(
      request(fixture.sourceFixtureId, adapter.id),
      fixture,
      adapter,
    );

    expect(result).toMatchObject({
      state: "failed",
      failure: {
        code: "adapter_failure",
        message: "local adapter unavailable",
        turn: 0,
      },
    });
  });

  it("cancels without mutating the completed turns", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const result = runScreeningPipeline(
      request(fixture.sourceFixtureId, baselineScreeningAdapter.id),
      fixture,
      baselineScreeningAdapter,
      { cancelAfterTurns: 1 },
    );

    expect(result).toMatchObject({
      state: "cancelled",
      terminalOutcome: "cancelled",
      interviewerIntents: ["open_conversation"],
      stateHistory: ["queued", "running", "cancelled"],
    });
  });

  it("produces deterministic repeated run output", () => {
    const fixture = simulatorFixtureBySourceId("f1");
    const runRequest = request(
      fixture.sourceFixtureId,
      baselineScreeningAdapter.id,
    );

    expect(
      runScreeningPipeline(runRequest, fixture, baselineScreeningAdapter),
    ).toEqual(
      runScreeningPipeline(runRequest, fixture, baselineScreeningAdapter),
    );
  });
});
