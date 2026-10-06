export const DEFAULT_BASE_DELAY_MS = 5_000;
export const DEFAULT_MAX_DELAY_MS = 300_000;

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
