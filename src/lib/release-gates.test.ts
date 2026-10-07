import { describe, expect, it } from "vitest";
import type { Check } from "../domain/models";
import { calculateReleaseStatus } from "./release-gates";

const check = (overrides: Partial<Check> = {}): Check => ({
  id: "check",
  releaseId: "release",
  kind: "unsupported_claim",
  title: "Claim check",
  fixtureIds: ["fixture"],
  status: "pass",
  isHardGate: true,
  rationale: "",
  evidenceIds: [],
  ...overrides,
});

describe("calculateReleaseStatus", () => {
  it("is ready when every hard gate passes", () => {
    expect(calculateReleaseStatus([check(), check({ id: "two" })])).toBe(
      "ready",
    );
  });

  it.each([
    "unsupported_claim",
    "missed_escalation",
    "paired_consistency",
  ] as const)("blocks a failed %s gate", (kind) => {
    expect(calculateReleaseStatus([check({ kind, status: "fail" })])).toBe(
      "blocked",
    );
  });

  it("ignores failed informational checks", () => {
    expect(
      calculateReleaseStatus([check({ isHardGate: false, status: "fail" })]),
    ).toBe("ready");
  });

  it("blocks despite high aggregate agreement when a hard gate fails", () => {
    expect(
      calculateReleaseStatus([check(), check({ id: "gate", status: "fail" })]),
    ).toBe("blocked");
  });

  it("is draft before checks exist", () => {
    expect(calculateReleaseStatus(undefined)).toBe("draft");
  });
});
