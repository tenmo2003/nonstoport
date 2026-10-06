// End-to-end tests: run bin/nonstoport.js as a real process against the fake nport.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { FAKE_NPORT, WRAPPER_BIN, newLogFile, readEvents, waitFor } from './fake-nport-helpers.js';

/** Starts the wrapper and collects its output; `exited` resolves with [code, signal]. */
function startWrapper(args, env = {}) {
  const child = spawn(process.execPath, [WRAPPER_BIN, ...args], {
    env: { ...process.env, NONSTOPORT_NPORT_BIN: FAKE_NPORT, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = { stdout: '', stderr: '' };
  child.stdout.on('data', (chunk) => (output.stdout += chunk));
  child.stderr.on('data', (chunk) => (output.stderr += chunk));
  return { child, output, exited: once(child, 'close') };
}

test('--help prints wrapper usage and does not spawn nport', async () => {
  const logFile = newLogFile();
  const { output, exited } = startWrapper(['--help'], { FAKE_NPORT_LOG: logFile });
  assert.equal((await exited)[0], 0);
  assert.match(output.stdout, /Usage: nonstoport <port>/);
  assert.deepEqual(readEvents(logFile), []);
});

test('--version prints the wrapper version and does not spawn nport', async () => {
  const logFile = newLogFile();
  const { output, exited } = startWrapper(['--version'], { FAKE_NPORT_LOG: logFile });
  assert.equal((await exited)[0], 0);
  assert.match(output.stdout, /^\d+\.\d+\.\d+\n$/);
  assert.deepEqual(readEvents(logFile), []);
});

test('missing nport binary: clear error, non-zero exit, no retry loop', async () => {
  const { output, exited } = startWrapper(['3000'], { NONSTOPORT_NPORT_BIN: '/nonexistent/nport' });
  assert.equal((await exited)[0], 1);
  assert.match(output.stderr, /\[nonstoport\] \S+ error: cannot start nport binary "\/nonexistent\/nport": not found/);
  assert.equal(output.stderr.match(/starting nport/g).length, 1);
});

test('one-shot nport command runs once and passes the exit code through', async () => {
  const logFile = newLogFile();
  const { exited } = startWrapper(['-v'], { FAKE_NPORT_LOG: logFile, FAKE_NPORT_PLAN: 'fail' });
  assert.equal((await exited)[0], 1);
  assert.deepEqual(readEvents(logFile), [{ event: 'start', args: ['-v'] }]);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`${signal} stops nport, waits for its cleanup and exits without restarting`, async () => {
    const logFile = newLogFile();
    const { child, output, exited } = startWrapper(['3000', '-b', 'https://x.test'], {
      FAKE_NPORT_LOG: logFile,
      FAKE_NPORT_PLAN: 'hang',
    });
    await waitFor(() => readEvents(logFile, 'start').length === 1);
    child.kill(signal);
    assert.deepEqual(await exited, [0, null]);

    const events = readEvents(logFile);
    assert.deepEqual(events.map((entry) => entry.event), ['start', 'cleanup']);
    assert.equal(events[1].signal, signal);
    const [port, backendFlag, backendUrl, subdomainFlag, subdomain] = events[0].args;
    assert.deepEqual([port, backendFlag, backendUrl, subdomainFlag], ['3000', '-b', 'https://x.test', '-s']);
    assert.match(subdomain, /^nsp-[a-z0-9]{8}$/);
    assert.match(output.stderr, new RegExp(`received ${signal}`));
  });
}
