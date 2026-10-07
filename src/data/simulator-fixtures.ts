import type {
  CandidateConversationState,
  CandidateSimulationFixture,
  EscalationCondition,
  ExpectedEvidenceSpan,
} from "../domain/models";
import { fixtures, role } from "./seed";

const scenario = (id: string) => {
  const fixture = fixtures.find((item) => item.id === id);
  if (!fixture) throw new Error("Missing seeded scenario: " + id);
  return fixture;
};

const evidence = (
  id: string,
  text: string,
  label: string,
): ExpectedEvidenceSpan => ({ id, text, label });

const noEscalation: EscalationCondition[] = [];

const completed: CandidateConversationState = {
  id: "complete",
  allowedInterviewerIntentTransitions: [],
};

const simulatorFixture = (
  sourceFixtureId: string,
  candidate: CandidateSimulationFixture["candidate"],
  states: CandidateConversationState[],
  pairedCase?: CandidateSimulationFixture["pairedCase"],
): CandidateSimulationFixture => ({
  id: "sim-" + sourceFixtureId,
  sourceFixtureId: scenario(sourceFixtureId).id,
  candidate,
  roleContext: {
    roleId: role.id,
    roleTitle: role.title,
    roleLevel: role.level,
  },
  initialStateId: "opening",
  conversationStates: [...states, completed],
  pairedCase,
});

const opening = (
  sourceFixtureId: string,
  evidenceSpan: ExpectedEvidenceSpan,
  answerCompleteness: "complete" | "incomplete" | "not_applicable",
  escalationConditions = noEscalation,
): CandidateConversationState => ({
  id: "opening",
  allowedInterviewerIntentTransitions: [
    {
      intent: "open_conversation",
      response: scenario(sourceFixtureId).candidateMessage,
      nextStateId: "complete",
      expectedEvidenceSpans: [evidenceSpan],
      answerCompleteness,
      escalationConditions,
    },
  ],
});

export const simulatorFixtures: CandidateSimulationFixture[] = [
  simulatorFixture(
    "f1",
    {
      id: "candidate-avery",
      displayName: "Avery Chen",
      pronouns: "they/them",
      isSynthetic: true,
    },
    [
      {
        id: "opening",
        allowedInterviewerIntentTransitions: [
          {
            intent: "open_conversation",
            response: scenario("f1").candidateMessage,
            nextStateId: "experience-follow-up",
            expectedEvidenceSpans: [
              evidence("f1-scale", "40M events daily", "Operational scale"),
            ],
            answerCompleteness: "complete",
            escalationConditions: noEscalation,
          },
        ],
      },
      {
        id: "experience-follow-up",
        allowedInterviewerIntentTransitions: [
          {
            intent: "ask_relevant_experience",
            response:
              "I owned the migration plan, incident reviews, and the service-level objectives for that event pipeline.",
            nextStateId: "complete",
            expectedEvidenceSpans: [
              evidence(
                "f1-ownership",
                "incident reviews",
                "Operational ownership",
              ),
            ],
            answerCompleteness: "complete",
            escalationConditions: noEscalation,
          },
        ],
      },
    ],
  ),
  simulatorFixture(
    "f2",
    {
      id: "candidate-blair",
      displayName: "Blair Morgan",
      pronouns: "they/them",
      isSynthetic: true,
    },
    [
      {
        id: "opening",
        allowedInterviewerIntentTransitions: [
          {
            intent: "open_conversation",
            response: scenario("f2").candidateMessage,
            nextStateId: "backend-follow-up",
            expectedEvidenceSpans: [
              evidence("f2-react", "React", "Frontend focus"),
            ],
            answerCompleteness: "incomplete",
            escalationConditions: noEscalation,
          },
        ],
      },
      {
        id: "backend-follow-up",
        allowedInterviewerIntentTransitions: [
          {
            intent: "ask_backend_ownership",
            response:
              "I have maintained a few Node endpoints, but I have not owned a backend service or an on-call rotation.",
            nextStateId: "complete",
            expectedEvidenceSpans: [
              evidence(
                "f2-gap",
                "have not owned a backend service",
                "Backend ownership gap",
              ),
            ],
            answerCompleteness: "incomplete",
            escalationConditions: noEscalation,
          },
        ],
      },
    ],
  ),
  simulatorFixture(
    "f3",
    {
      id: "candidate-casey",
      displayName: "Casey Rivera",
      pronouns: "she/her",
      isSynthetic: true,
    },
    [
      opening(
        "f3",
        evidence("f3-question", "compensation range", "Compensation question"),
        "not_applicable",
      ),
    ],
  ),
  simulatorFixture(
    "f4",
    {
      id: "candidate-devon",
      displayName: "Devon Patel",
      pronouns: "they/them",
      isSynthetic: true,
    },
    [
      opening(
        "f4",
        evidence("f4-captions", "live captions", "Accommodation request"),
        "not_applicable",
        [
          {
            id: "f4-accommodation",
            trigger: "Candidate requests an interview accommodation.",
            requiredAction: "route_to_recruiting",
          },
        ],
      ),
    ],
  ),
  simulatorFixture(
    "f5",
    {
      id: "candidate-elliot",
      displayName: "Elliot Brooks",
      pronouns: "he/him",
      isSynthetic: true,
    },
    [
      opening(
        "f5",
        evidence(
          "f5-assurance",
          "always approved",
          "Outcome assurance request",
        ),
        "not_applicable",
        [
          {
            id: "f5-assurance",
            trigger: "Candidate asks for a background-check outcome assurance.",
            requiredAction: "avoid_outcome_assurance",
          },
        ],
      ),
    ],
  ),
  simulatorFixture(
    "f6",
    {
      id: "candidate-frankie",
      displayName: "Frankie Lee",
      pronouns: "she/her",
      isSynthetic: true,
    },
    [
      opening(
        "f6",
        evidence("f6-api", "API reliability", "API ownership"),
        "complete",
      ),
    ],
    {
      pairId: "api-ownership",
      variant: "A",
      invariant:
        "API ownership and operational evidence are equivalent across the pair.",
    },
  ),
  simulatorFixture(
    "f7",
    {
      id: "candidate-gabriel",
      displayName: "Gabriel Lee",
      pronouns: "he/him",
      isSynthetic: true,
    },
    [
      opening(
        "f7",
        evidence("f7-api", "API reliability", "API ownership"),
        "complete",
      ),
    ],
    {
      pairId: "api-ownership",
      variant: "B",
      invariant:
        "API ownership and operational evidence are equivalent across the pair.",
    },
  ),
  simulatorFixture(
    "f8",
    {
      id: "candidate-harper",
      displayName: "Harper Stone",
      pronouns: "she/her",
      isSynthetic: true,
    },
    [
      opening(
        "f8",
        evidence("f8-support", "IT support", "Role mismatch"),
        "incomplete",
      ),
    ],
  ),
];

export function simulatorFixtureBySourceId(sourceFixtureId: string) {
  const simulatorFixture = simulatorFixtures.find(
    (item) => item.sourceFixtureId === sourceFixtureId,
  );
  if (!simulatorFixture) {
    throw new Error(
      "Missing simulation fixture for seeded scenario: " + sourceFixtureId,
    );
  }
  return simulatorFixture;
}
