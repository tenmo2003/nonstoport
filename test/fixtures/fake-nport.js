#!/usr/bin/env node
// Fake nport for tests. Never opens a tunnel.
// Appends one JSON line per event to FAKE_NPORT_LOG and behaves according to
// FAKE_NPORT_PLAN, a comma-separated list with one step per start (last step repeats):
//   fail        exit 1 immediately
//   live:<ms>   exit 0 after <ms> (simulates the 4h expiry)
//   hang        run until SIGINT/SIGTERM, do a short cleanup, exit 0
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const logFile = process.env.FAKE_NPORT_LOG;
const plan = (process.env.FAKE_NPORT_PLAN || 'hang').split(',');
const record = (entry) => appendFileSync(logFile, `${JSON.stringify(entry)}\n`);

const previousStarts = existsSync(logFile)
  ? readFileSync(logFile, 'utf8').split('\n').filter((line) => line.includes('"start"')).length
  : 0;
const [step, ms] = plan[Math.min(previousStarts, plan.length - 1)].split(':');
record({ event: 'start', args: process.argv.slice(2) });

if (step === 'fail') {
  process.exit(1);
} else if (step === 'live') {
  setTimeout(() => process.exit(0), Number(ms));
} else {
  const keepAlive = setInterval(() => {}, 1_000);
  const cleanup = (signal) => {
    clearInterval(keepAlive);
    setTimeout(() => {
      record({ event: 'cleanup', signal });
      process.exit(0);
    }, 100);
  };
  process.once('SIGINT', () => cleanup('SIGINT'));
  process.once('SIGTERM', () => cleanup('SIGTERM'));
}
