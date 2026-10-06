#!/usr/bin/env node
// nonstoport: runs nport and restarts it on the same URL whenever it exits.

import { readFileSync } from 'node:fs';
import { parseCli } from '../src/nport-args.js';
import { logToStderr, runNport, superviseNport } from '../src/nport-supervisor.js';

const USAGE = `Usage: nonstoport <port> [nport options]

Runs "nport <port>" and restarts it whenever it exits (4h tunnel expiry or
crash), always on the same subdomain so the URL does not change.

nport options (forwarded unchanged):
  -s, --subdomain <name>   Subdomain to use (default: generated once, e.g. nsp-k3x9a0bq)
  -b, --backend <url>      Backend URL
  -l, --language <code>    Language (en, vi, es)
  --set-backend [url]      Save/clear the default backend (runs nport once)
  -v                       Show the nport version (runs nport once)

Wrapper options:
  -h, --help               Show this help
  --version                Show the nonstoport version

Environment:
  NONSTOPORT_NPORT_BIN     nport binary to run (default: "nport" from PATH)
`;

async function main() {
  const cli = parseCli(process.argv.slice(2));
  if (cli.mode === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }
  if (cli.mode === 'version') {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }

  const bin = process.env.NONSTOPORT_NPORT_BIN || 'nport';
  if (cli.mode === 'oneshot') {
    const { code } = await runNport(bin, cli.args);
    return code ?? 1;
  }
  return superviseNport({ bin, args: cli.args });
}

main().then(
  (code) => process.exit(code),
  (error) => {
    logToStderr(`error: ${error.message}`);
    process.exit(1);
  },
);
