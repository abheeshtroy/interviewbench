import type { CheckStatus, ReleaseStatus } from "../domain/models";

export function StatusBadge({
  status,
}: {
  status: ReleaseStatus | CheckStatus;
}) {
  return (
    <span className={`status status--${status}`}>{status.toUpperCase()}</span>
  );
}
