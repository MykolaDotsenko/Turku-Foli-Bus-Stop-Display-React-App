const BASE_RETRY_MS = 5_000;
const MAX_RETRY_MS = 5 * 60_000;

export function retryDelayMs(consecutiveFailures) {
  const failures = Math.max(1, Math.floor(Number(consecutiveFailures) || 0));

  return Math.min(BASE_RETRY_MS * 2 ** (failures - 1), MAX_RETRY_MS);
}
