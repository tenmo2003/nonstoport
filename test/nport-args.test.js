import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNportArgs, generateSubdomain, hasSubdomain, parseCli } from '../src/nport-args.js';

test('generated subdomain is prefixed, lowercase alphanumeric and random', () => {
  const first = generateSubdomain();
  assert.match(first, /^nsp-[a-z0-9]{8}$/);
  assert.notEqual(first, generateSubdomain());
});

test('hasSubdomain detects every form nport accepts', () => {
  assert.equal(hasSubdomain(['3000', '-s', 'myapp']), true);
  assert.equal(hasSubdomain(['3000', '--subdomain', 'myapp']), true);
  assert.equal(hasSubdomain(['3000', '-s=myapp']), true);
  assert.equal(hasSubdomain(['3000', '--subdomain=myapp']), true);
  assert.equal(hasSubdomain(['3000']), false);
  assert.equal(hasSubdomain(['3000', '-b', 'https://x.test']), false);
  assert.equal(hasSubdomain(['3000', '-s']), false);
});

test('injects -s <generated> when the user gave no subdomain', () => {
  assert.deepEqual(buildNportArgs(['3000'], 'nsp-abc'), ['3000', '-s', 'nsp-abc']);
  assert.deepEqual(buildNportArgs(['3000', '-s'], 'nsp-abc'), ['3000', '-s', 'nsp-abc']);
});

test('keeps the user subdomain and forwards other flags unchanged', () => {
  assert.deepEqual(buildNportArgs(['3000', '-s', 'myapp'], 'nsp-abc'), ['3000', '-s', 'myapp']);
  const argv = ['3000', '-b', 'https://x.test', '-l', 'vi'];
  assert.deepEqual(buildNportArgs(argv, 'nsp-abc'), [...argv, '-s', 'nsp-abc']);
});

test('parseCli: tunnel mode generates the subdomain once', () => {
  assert.deepEqual(parseCli(['3000'], () => 'nsp-fixed'), { mode: 'tunnel', args: ['3000', '-s', 'nsp-fixed'] });
  assert.deepEqual(parseCli(['3000', '-s', 'myapp']), { mode: 'tunnel', args: ['3000', '-s', 'myapp'] });
});

test('parseCli: wrapper flags are not forwarded', () => {
  assert.deepEqual(parseCli(['--help']), { mode: 'help' });
  assert.deepEqual(parseCli(['3000', '-h']), { mode: 'help' });
  assert.deepEqual(parseCli(['--version']), { mode: 'version' });
});

test('parseCli: one-shot nport commands are passed through without a subdomain', () => {
  assert.deepEqual(parseCli(['-v']), { mode: 'oneshot', args: ['-v'] });
  assert.deepEqual(parseCli(['--set-backend', 'https://x.test']), {
    mode: 'oneshot',
    args: ['--set-backend', 'https://x.test'],
  });
  assert.deepEqual(parseCli(['--set-backend']), { mode: 'oneshot', args: ['--set-backend'] });
  assert.deepEqual(parseCli(['-l']), { mode: 'oneshot', args: ['-l'] });
  assert.equal(parseCli(['3000', '-l', 'vi']).mode, 'tunnel');
});
