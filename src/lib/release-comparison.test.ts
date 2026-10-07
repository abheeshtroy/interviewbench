import { describe, expect, it } from "vitest";
import { aggregateReleaseComparison } from "./release-comparison";

describe("computed release comparison", () => {
  const comparison = aggregateReleaseComparison();

  it("blocks the proposed configuration for deterministic and human-reviewed hard gates", () => {
    expect(comparison.status).toBe("blocked");
    expect(
      comparison.checks.filter(
        (check) => check.isHardGate && check.status === "fail",
      ),
    ).toHaveLength(2);
    expect(
      comparison.checks.find((check) => check.kind === "unsupported_claim")
        ?.classification,
    ).toBe("human_reviewed_hard_gate");
    expect(
      comparison.checks.find((check) => check.kind === "missed_escalation")
        ?.classification,
    ).toBe("deterministic_hard_gate");
  });

  it("keeps baseline and proposed pipeline runs separate", () => {
    expect(comparison.baselineRuns).toHaveLength(8);
    expect(comparison.proposedRuns).toHaveLength(8);
    expect(
      comparison.baselineRuns.every(
        (run) => run.configurationId === "release-baseline",
      ),
    ).toBe(true);
    expect(
      comparison.proposedRuns.every(
        (run) => run.configurationId === "release-proposed",
      ),
    ).toBe(true);
  });

  it("keeps release blocked despite a passing aggregate agreement metric", () => {
    const agreement = comparison.checks.find(
      (check) => check.kind === "aggregate_agreement",
    )!;
    expect(agreement.status).toBe("pass");
    expect(comparison.aggregateAgreement.percentage).toBeGreaterThan(0);
    expect(comparison.status).toBe("blocked");
  });

  it("keeps claim support distinct from deterministic citation resolution", () => {
    expect(
      comparison.citations.every((result) => result.status === "pass"),
    ).toBe(true);
    expect(comparison.claimSupport).toMatchObject([
      { evaluatorType: "claim_support", status: "fail" },
    ]);
  });

  it("keeps paired-case differences as review-required findings", () => {
    expect(comparison.pairedReviews).toMatchObject([
      {
        evaluatorType: "paired_case_consistency",
        status: "review",
        reviewRequired: true,
      },
    ]);
    const pairCheck = comparison.checks.find(
      (check) => check.kind === "paired_consistency",
    )!;
    expect(pairCheck.isHardGate).toBe(false);
    expect(pairCheck.classification).toBe("review_required");
  });

  it("provides computed evaluator evidence for the UI", () => {
    expect(comparison.evidence.length).toBeGreaterThan(0);
    expect(
      comparison.checks
        .filter((check) => check.status === "fail")
        .every((check) => check.evidenceIds.length > 0),
    ).toBe(true);
  });
});
