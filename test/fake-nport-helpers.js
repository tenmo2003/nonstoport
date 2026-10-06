import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FAKE_NPORT = fileURLToPath(new URL('./fixtures/fake-nport.js', import.meta.url));
export const WRAPPER_BIN = fileURLToPath(new URL('../bin/nonstoport.js', import.meta.url));

export function newLogFile() {
  return join(mkdtempSync(join(tmpdir(), 'nonstoport-test-')), 'fake-nport.log');
}

export function readEvents(logFile, event) {
  if (!existsSync(logFile)) return [];
  const events = readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  return event ? events.filter((entry) => entry.event === event) : events;
}

export async function waitFor(predicate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
