import { randomInt } from 'node:crypto';

const SUBDOMAIN_PREFIX = 'nsp-';
const SUBDOMAIN_RANDOM_LENGTH = 8;
const SUBDOMAIN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SUBDOMAIN_FLAGS = ['-s', '--subdomain'];
const LANGUAGE_FLAGS = ['-l', '--lang', '--language'];

export function generateSubdomain() {
  let suffix = '';
  for (let i = 0; i < SUBDOMAIN_RANDOM_LENGTH; i++) {
    suffix += SUBDOMAIN_ALPHABET[randomInt(SUBDOMAIN_ALPHABET.length)];
  }
  return SUBDOMAIN_PREFIX + suffix;
}

function hasDanglingSubdomainFlag(argv) {
  return SUBDOMAIN_FLAGS.includes(argv.at(-1));
}

/**
 * True when the user already chose a subdomain. Mirrors the forms nport accepts:
 * `-s name`, `--subdomain name`, `-s=name`, `--subdomain=name`.
 */
export function hasSubdomain(argv) {
  return argv.some((arg, i) => {
    if (SUBDOMAIN_FLAGS.includes(arg)) return Boolean(argv[i + 1]);
    return SUBDOMAIN_FLAGS.some((flag) => arg.startsWith(`${flag}=`) && arg.length > flag.length + 1);
  });
}

export function buildNportArgs(argv, subdomain) {
  if (hasSubdomain(argv)) return [...argv];
  // A trailing value-less `-s` only needs its value, otherwise nport would read "-s" as the name.
  if (hasDanglingSubdomainFlag(argv)) return [...argv, subdomain];
  return [...argv, '-s', subdomain];
}

/**
 * nport commands that do their job and exit instead of opening a tunnel:
 * `-v`, `--set-backend[=url]`, and a language flag without a value (language prompt).
 */
function isOneShot(argv) {
  return argv.some((arg, i) => {
    if (arg === '-v' || arg === '--set-backend' || arg.startsWith('--set-backend=')) return true;
    if (!LANGUAGE_FLAGS.includes(arg)) return false;
    const value = argv[i + 1];
    return !value || value.startsWith('-');
  });
}

/**
 * Classifies the wrapper's argv.
 * - `help` / `version`: handled by the wrapper, nport is not spawned
 * - `oneshot`: run nport once with the args unchanged, no restart loop
 * - `tunnel`: supervise nport with `args` (subdomain injected when missing)
 */
export function parseCli(argv, makeSubdomain = generateSubdomain) {
  if (argv.includes('--help') || argv.includes('-h')) return { mode: 'help' };
  if (argv.includes('--version')) return { mode: 'version' };
  if (isOneShot(argv)) return { mode: 'oneshot', args: [...argv] };
  return { mode: 'tunnel', args: buildNportArgs(argv, hasSubdomain(argv) ? undefined : makeSubdomain()) };
}
