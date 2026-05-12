# d2p — demo to product

Drive a local Claude Code CLI to mature a demo into a product.

> **Status**: MVP-0 walking skeleton — end-to-end loop runs from a fake-claude
> fixture. Real cc integration depends on the user having `claude` on PATH and
> logged in. See `docs/DEV-DOC.md` for the full design.

## What it does

Given a local repo + a vision (elicited via a short Q&A), d2p:

1. Asks the user the smallest set of questions needed to lock a product vision.
2. Detects the repo type and loads a baseline checklist (preset).
3. Loops: pick a gap → spawn a `claude` worker in a git worktree → run a
   3-layer reviewer pipeline → merge `fix/<slug>` into `main`.
4. Stops when both the preset is fully ✓ *and* an independent reviewer says
   the vision is satisfied. Cap or pause any time.

Pure local. No API key (drives `claude` CLI). One demo per d2p instance.

## Quick start

```bash
git clone <repo> && cd d2p
npm install
npm run build
npm link --workspaces        # exposes `d2p` globally

d2p doctor                   # verifies cc + git
d2p start                    # spawns daemon + opens UI on http://localhost:5173
```

## Layout

| Path | What |
|---|---|
| `daemon/` | Hono server on `:5174` — orchestrator, agents, storage |
| `ui/` | Vite + React app on `:5173` — observation panel |
| `cli/` | `d2p start/stop/status/open/doctor` |
| `presets/` | 6 internal markdown presets (saas-web / api-service / cli-tool / library / static-site / unknown) |
| `scripts/` | dev runner, smoke test, fake-claude shim |
| `fixtures/` | tiny demo + canned responses used by smoke |
| `docs/` | `DEV-DOC.md` + `details/` per-component specs + `plans/` |

## Verify

```bash
npm run typecheck            # all three workspaces
npm test                     # daemon unit tests (36)
npm run smoke                # end-to-end with fake claude
```

## Development

See `CLAUDE.md` for workflow rules. The walking-skeleton plan is in
`docs/plans/2026-05-12-walking-skeleton.md`. The full design is
`docs/DEV-DOC.md`.

## License

TBD.
