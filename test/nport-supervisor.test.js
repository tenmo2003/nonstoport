import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { beforeEach, test } from 'node:test';
import { createBackoff } from '../src/exponential-backoff.js';
import { NportSpawnError, superviseNport } from '../src/nport-supervisor.js';
import { FAKE_NPORT, newLogFile, readEvents, waitFor } from './fake-nport-helpers.js';

const ARGS = ['3000', '-s', 'nsp-fixed'];
let logFile;
let proc;
let logs;

beforeEach(() => {
  logFile = newLogFile();
  process.env.FAKE_NPORT_LOG = logFile;
  proc = new EventEmitter(); // stands in for `process` as the signal source
  logs = [];
});

function recordingBackoff() {
  const inner = createBackoff({ baseMs: 5, maxMs: 40 });
  const calls = [];
  return {
    calls,
    next() {
      const delay = inner.next();
      calls.push(delay);
      return delay;
    },
    reset() {
      calls.push('reset');
      inner.reset();
    },
  };
}

function supervise(plan, options = {}) {
  process.env.FAKE_NPORT_PLAN = plan;
  return superviseNport({ bin: FAKE_NPORT, args: ARGS, proc, log: (line) => logs.push(line), ...options });
}

const starts = () => readEvents(logFile, 'start');

test('restarts an expired tunnel with the exact same args', async () => {
  const backoff = recordingBackoff();
  const done = supervise('live:150', { backoff, minUptimeMs: 100, restartDelayMs: 10 });
  await waitFor(() => starts().length >= 3);
  proc.emit('SIGTERM', 'SIGTERM');
  assert.equal(await done, 0);
  for (const start of starts()) assert.deepEqual(start.args, ARGS);
  assert.ok(backoff.calls.length >= 2);
  assert.ok(backoff.calls.every((call) => call === 'reset'), 'successful runs never back off');
});

test('retries quick failures with doubling, capped delays and never gives up', async () => {
  const backoff = recordingBackoff();
  const done = supervise('fail', { backoff });
  await waitFor(() => backoff.calls.length >= 6);
  proc.emit('SIGINT', 'SIGINT');
  assert.equal(await done, 0);
  assert.deepEqual(backoff.calls.slice(0, 6), [5, 10, 20, 40, 40, 40]);
  assert.match(logs.join('\n'), /attempt 6/);
  assert.match(logs.join('\n'), /failed start\), restarting in 0\.005s/);
});

test('backoff resets after a successful run', async () => {
  const backoff = recordingBackoff();
  const done = supervise('fail,fail,live:150,fail,hang', { backoff, minUptimeMs: 100, restartDelayMs: 10 });
  await waitFor(() => starts().length >= 5);
  proc.emit('SIGTERM', 'SIGTERM');
  await done;
  assert.deepEqual(backoff.calls, [5, 10, 'reset', 5]);
});

test('stop signal is forwarded, child cleanup is awaited, no restart', async () => {
  const done = supervise('hang');
  await waitFor(() => starts().length === 1);
  proc.emit('SIGINT', 'SIGINT');
  assert.equal(await done, 0);
  assert.deepEqual(readEvents(logFile, 'cleanup'), [{ event: 'cleanup', signal: 'SIGINT' }]);
  assert.equal(starts().length, 1);
  assert.equal(proc.listenerCount('SIGINT') + proc.listenerCount('SIGTERM') + proc.listenerCount('SIGHUP'), 0);
});

test('stop signal cancels a pending backoff wait', async () => {
  const done = supervise('fail', { backoff: createBackoff({ baseMs: 60_000 }) });
  await waitFor(() => logs.some((line) => line.includes('restarting in 60s')));
  const signalledAt = Date.now();
  proc.emit('SIGTERM', 'SIGTERM');
  assert.equal(await done, 0);
  assert.ok(Date.now() - signalledAt < 1_000);
  assert.equal(starts().length, 1);
});

test('missing nport binary rejects with a clear error and no retry', async () => {
  const backoff = recordingBackoff();
  await assert.rejects(
    superviseNport({ bin: '/nonexistent/nport', args: ARGS, proc, backoff, log: (line) => logs.push(line) }),
    (error) => error instanceof NportSpawnError && /cannot start nport binary "\/nonexistent\/nport": not found/.test(error.message),
  );
  assert.deepEqual(backoff.calls, []);
});
