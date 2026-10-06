// Supervisor loop: keeps one nport child alive, restarting it whenever it exits.

import { spawn } from 'node:child_process';
import { createBackoff } from './exponential-backoff.js';

export const DEFAULT_MIN_UPTIME_MS = 60_000; // a run this long counts as successful
export const DEFAULT_RESTART_DELAY_MS = 2_000; // lets nport's DNS cleanup settle
const STOP_SIGNALS = ['SIGINT', 'SIGTERM'];

/** Thrown when the nport binary cannot be started at all (never retried). */
export class NportSpawnError extends Error {
  constructor(bin, cause) {
    const reason = cause.code === 'ENOENT' ? 'not found' : cause.message;
    super(
      `cannot start nport binary "${bin}": ${reason}. ` +
        'Install it with "npm install -g nport" or set NONSTOPORT_NPORT_BIN.',
      { cause },
    );
    this.name = 'NportSpawnError';
  }
}

/** Writes a wrapper log line to stderr: `[nonstoport] <ISO time> <message>`. */
export function logToStderr(message) {
  process.stderr.write(`[nonstoport] ${new Date().toISOString()} ${message}\n`);
}

/**
 * Runs nport once with inherited stdio.
 * Resolves with `{ code, signal }` on exit, rejects with NportSpawnError if it cannot start.
 * `onChild` receives the child process so the caller can forward signals to it.
 */
export function runNport(bin, args, onChild = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: 'inherit' });
    child.once('error', (error) => reject(new NportSpawnError(bin, error)));
    child.once('exit', (code, signal) => resolve({ code, signal }));
    onChild(child);
  });
}

function describeExit({ code, signal }) {
  return signal ? `signal ${signal}` : `code ${code}`;
}

/**
 * Supervises nport until the wrapper receives SIGINT/SIGTERM.
 * - run lasted >= minUptimeMs: restart after restartDelayMs, backoff reset
 * - shorter run: restart after backoff.next() (retries forever)
 * - stop signal: forwarded to the child, its exit is awaited, no restart
 * Resolves with the wrapper exit code; rejects with NportSpawnError.
 * `proc` is the signal source (injectable for tests).
 */
export async function superviseNport({
  bin,
  args,
  backoff = createBackoff(),
  minUptimeMs = DEFAULT_MIN_UPTIME_MS,
  restartDelayMs = DEFAULT_RESTART_DELAY_MS,
  log = logToStderr,
  proc = process,
}) {
  let stopping = false;
  let child = null;
  let cancelWait = null;

  const onStopSignal = (signal) => {
    if (!stopping) log(`received ${signal}, stopping nport and exiting`);
    stopping = true;
    child?.kill(signal);
    cancelWait?.();
  };
  // Cancellable sleep: resolves early when a stop signal arrives.
  const wait = (ms) =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      cancelWait = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  for (const signal of STOP_SIGNALS) proc.on(signal, onStopSignal);
  try {
    for (let attempt = 1; !stopping; attempt++) {
      log(`starting nport (attempt ${attempt}): ${[bin, ...args].join(' ')}`);
      const startedAt = Date.now();
      const exit = await runNport(bin, args, (spawned) => {
        child = spawned;
      });
      child = null;
      if (stopping) break;

      const uptimeMs = Date.now() - startedAt;
      const succeeded = uptimeMs >= minUptimeMs;
      if (succeeded) backoff.reset();
      const delayMs = succeeded ? restartDelayMs : backoff.next();
      log(
        `nport exited with ${describeExit(exit)} after ${Math.round(uptimeMs / 1000)}s ` +
          `(${succeeded ? 'tunnel expired or stopped' : 'failed start'}), restarting in ${delayMs / 1000}s`,
      );
      await wait(delayMs);
    }
    return 0;
  } finally {
    for (const signal of STOP_SIGNALS) proc.off(signal, onStopSignal);
  }
}
