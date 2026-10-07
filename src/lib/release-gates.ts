import type { Check, ReleaseStatus } from "../domain/models";

export function calculateReleaseStatus(
  checks: Check[] | undefined,
): ReleaseStatus {
  if (!checks) return "draft";
  return checks.some((check) => check.isHardGate && check.status === "fail")
    ? "blocked"
    : "ready";
}

export function hardGateSummary(checks: Check[]) {
  const hardGates = checks.filter((check) => check.isHardGate);
  const passed = hardGates.filter((check) => check.status === "pass").length;
  return { passed, total: hardGates.length, failed: hardGates.length - passed };
}
