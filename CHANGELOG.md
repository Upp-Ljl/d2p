# Changelog

## Unreleased — MVP-0 walking skeleton

### Added
- Daemon (`@d2p/daemon`): Hono server, SQLite + 3 migrations, 9 agent prompts +
  zod schemas, `claude` / `git` subprocess wrappers with timeout + injection
  guard, full reviewer pipeline (alignment / behavioral / adversarial), git
  worktree manager, orchestrator loop, REST + SSE routes for session / vision
  / detector / preset / loop / gaps / log / health.
- UI (`@d2p/ui`): minimal Vite + React + Tailwind scaffold; health badge + SSE
  live event log.
- CLI (`@d2p/cli`): `d2p start | stop | status | open | doctor`.
- 6 internal presets covering saas-web / api-service / cli-tool / library /
  static-site / unknown.
- End-to-end smoke (`scripts/smoke-walking-skeleton.mjs`) driven by a
  `scripts/fake-claude.mjs` shim. Asserts at least one merged fix and a
  `SESSION_DONE` transition.
- 36 daemon unit tests across state machine, migrations, queries, prompt
  render, and path utilities.

### Verified

- `npm install`, `npm run typecheck`, `npm test`, `npm run build`, and
  `node scripts/smoke-walking-skeleton.mjs` all green on Windows 11 + Node 24.
