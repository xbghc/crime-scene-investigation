# Multiplayer browser testing

## Current verification status

The repeatable Playwright harness is prepared locally. **Browser gameplay has not been verified.**

Verified in the current cloud executor:
- Existing project dependency: Playwright 1.58.2; installed system browser: Chromium 154.0.8037.57.
- `ldd /usr/lib/chromium/chromium` reports no unresolved shared libraries.
- Config/spec syntax, ESLint for the config, and Playwright discovery pass (3 tests).
- Both the app server and Vite server become ready through the Playwright `webServer` configuration.
- An actual run stopped in browser fixture startup, before any page or UI assertion ran. Chromium aborts at `ProcessSingleton` with `socket() failed: Operation not permitted (1)`.
- A minimal independent Python probe confirms that creating an `AF_UNIX` socket is denied with EPERM; IPv4/IPv6 socket creation is allowed. The executor has an active seccomp filter. The immediate obstacle is platform IPC policy, not a missing browser library. No sandbox/security policy was changed.

Installing another copy of Chromium cannot fix this denial. Use a supported browser-capable cloud coding environment, or authorize a repository CI run. No saved cloud coding environment was available when checked. The separate cloud UI browser could not reach the executor's loopback app in earlier checks; it is not a supported substitute for a co-located test runner.

## Run in a browser-capable environment

From the repository root, with Node 22 and the repository's pnpm version:

```sh
pnpm install --frozen-lockfile
node node_modules/playwright/cli.js install --with-deps chromium
node node_modules/playwright/cli.js test --config=playwright.multiplayer.config.mjs
```

`--with-deps` uses the official Playwright installer and the system package manager. On a managed machine, follow its approval requirements for system packages. Ports 8030 and 8040 must be free. The runner starts and stops its own app servers, does not reuse another running game, uses a fixed test-only six-digit password, and uses a test-only signing secret. Never deploy these test credentials. No production account or secrets are required.

The browser uses `http://127.0.0.1:8030`; Vite proxies to the local backend. This does not require hosting the app publicly or opening a tunnel. The existing backend binds using Node's default interface behavior; run this configuration only in an isolated local/CI environment without inbound public port exposure.

To use an already-installed compatible Chromium for diagnosis only:

```sh
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium node node_modules/playwright/cli.js test --config=playwright.multiplayer.config.mjs
```

For supported repeatable results, prefer the matching Playwright-managed Chromium downloaded by the installer.

## Coverage

Each player gets a separate browser context (isolated cookies and localStorage), a mobile-sized viewport, and a UI password entry. Every game/room mutation is through visible UI; no direct socket emissions, server timer shortcuts, store writes or API-authentication shortcuts are used. Read-only Pinia observations check phase/private state and require the configured Vite development server.

1. Malformed and valid-but-missing room rejection; two isolated lobbies; host leave and ownership transfer; rejoin; reload restores membership without duplicate players; non-host start controls absent; too-few-player start disabled.
2. Four players: create/join, start, role assignment, actual page reload/reconnection, private role/solution assertions, murderer selects cards, witness confirms and marks six boards, detective uses solve wizard including cancel/reopen/back, winning result visible to all four, then host replay resets everyone to the lobby.
3. Eight isolated browser contexts in two four-player rooms: room A starts while B stays in its lobby, then B starts; each room's roster and room code remain distinct.

Four-player rules are witness + murderer + two detectives. An accomplice is only assigned with at least six players. This suite does not claim to cover accomplice actions, all three discussion rounds, force-solve, delayed host transfer after a prolonged network outage, or load/performance limits. Console/network diagnostics are saved for investigation; only uncaught page errors are hard assertions, since existing optional card/font assets may fail independently of gameplay. The current non-host browser assertions check the available UI; existing backend protocol tests, not these UI checks alone, establish server-side authorization behavior.

## Evidence and reports

After a browser-capable run:
- `playwright-report/`: HTML report.
- `test-results/multiplayer/`: per-player screenshots, traces and captured JavaScript page errors, console errors, failed requests and HTTP errors.
- `node node_modules/playwright/cli.js show-report` opens the report locally.

These folders are ignored by Git. Test traces include this synthetic game's authentication and role state; keep reports private to repository collaborators. No real-player data is used.

## Optional GitHub Actions proposal

`e2e/github-actions.multiplayer.yml.example` is an **inactive draft**. It has not been installed as a workflow, committed, pushed or run remotely. After authorization, move it to `.github/workflows/multiplayer-ui.yml` on a new branch and create a draft PR. It uses a GitHub-hosted runner, `contents: read`, no deployment, no repository secrets, and seven-day report retention. The PR run is the first intended browser-runtime validation and may reveal test or application bugs that static checks cannot establish.

Official references: [Playwright browser installation](https://playwright.dev/docs/browsers), [browser-context isolation](https://playwright.dev/docs/browser-contexts), [Playwright web servers](https://playwright.dev/docs/test-webserver).
