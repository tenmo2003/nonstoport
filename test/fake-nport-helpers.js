// Shared helpers for tests that run the fake nport fixture.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FAKE_NPORT = fileURLToPath(new URL('./fixtures/fake-nport.js', import.meta.url));
export const WRAPPER_BIN = fileURLToPath(new URL('../bin/nonstoport.js', import.meta.url));

/** Returns a fresh log file path for one test. */
export function newLogFile() {
  return join(mkdtempSync(join(tmpdir(), 'nonstoport-test-')), 'fake-nport.log');
}

/** Reads the events the fake nport recorded, optionally filtered by event name. */
export function readEvents(logFile, event) {
  if (!existsSync(logFile)) return [];
  const events = readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  return event ? events.filter((entry) => entry.event === event) : events;
}

/** Polls until `predicate()` is true or the timeout passes. */
export async function waitFor(predicate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
