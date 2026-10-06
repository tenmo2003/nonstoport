# nonstoport

Wrapper around the [nport](https://github.com/tuanngocptn/nport) CLI that keeps a tunnel up.
nport tunnels expire after 4 hours; `nonstoport` restarts nport whenever it exits and always
reuses the same subdomain, so the public URL stays the same.

## Install

Requires Node.js >= 22 and `nport` on your `PATH` (`npm install -g nport`).

```sh
cd nonstoport
npm link
```

No runtime dependencies.

## Usage

```sh
nonstoport 3000                 # runs: nport 3000 -s nsp-<8 random chars>
nonstoport 3000 -s myapp        # runs: nport 3000 -s myapp
nonstoport 3000 -b https://my-backend.example -l vi
nonstoport --help               # wrapper help (nport is not started)
nonstoport --version            # wrapper version
```

All arguments are forwarded to nport unchanged. Only `-h`/`--help` and `--version` are handled
by the wrapper itself.

Set `NONSTOPORT_NPORT_BIN` to use a specific nport binary instead of the one on `PATH`.

## Behaviour

- **Same URL**: with `-s`/`--subdomain` your subdomain is used. Without it, one subdomain
  (`nsp-` + 8 random characters) is generated at startup and reused on every restart.
- **Restart on exit**: when nport exits after running for at least 60 seconds (tunnel expiry,
  crash), it is restarted after 2 seconds with the same arguments.
- **Retry on failure**: when nport exits sooner than that (rate limit, subdomain taken, backend
  error), it is retried forever with exponential backoff: 5s, 10s, 20s ... up to 5 minutes.
  The backoff resets after a successful run.
- **Stopping**: Ctrl+C or `SIGTERM` is forwarded to nport; the wrapper waits for nport to clean
  up its tunnel, then exits without restarting. A pending retry wait is cancelled.
- **One-shot nport commands** (`-v`, `--set-backend`, a language flag without a value) run
  nport once and pass its exit code through, with no restart loop.
- **Missing nport binary**: prints an error and exits with code 1, no retries.
- **Logging**: nport's own output is shown as-is. Wrapper lines go to stderr as
  `[nonstoport] <timestamp> <message>` (restart reason, attempt number, next delay).

## Development

```sh
npm test    # node:test, runs against a fake nport (never opens a real tunnel)
```
