// Exponential backoff for failed nport starts: 5s, 10s, 20s ... capped at 5 minutes.

export const DEFAULT_BASE_DELAY_MS = 5_000;
export const DEFAULT_MAX_DELAY_MS = 300_000;

/**
 * Creates a backoff counter.
 * `next()` returns the delay for the upcoming retry and doubles the following one.
 * `reset()` goes back to the base delay (called after a successful run).
 */
export function createBackoff({ baseMs = DEFAULT_BASE_DELAY_MS, maxMs = DEFAULT_MAX_DELAY_MS } = {}) {
  let current = baseMs;
  return {
    next() {
      const delay = current;
      current = Math.min(current * 2, maxMs);
      return delay;
    },
    reset() {
      current = baseMs;
    },
  };
}
