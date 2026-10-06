import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBackoff } from '../src/exponential-backoff.js';

test('default delays double from 5s and cap at 300s', () => {
  const backoff = createBackoff();
  const delays = Array.from({ length: 9 }, () => backoff.next());
  assert.deepEqual(delays, [5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000, 300_000]);
});

test('reset returns to the base delay', () => {
  const backoff = createBackoff();
  backoff.next();
  backoff.next();
  backoff.reset();
  assert.equal(backoff.next(), 5_000);
});

test('base and max delays are injectable', () => {
  const backoff = createBackoff({ baseMs: 1, maxMs: 3 });
  assert.deepEqual([backoff.next(), backoff.next(), backoff.next()], [1, 2, 3]);
});
