# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page Vite + React 19 site that tracks nine Zenon Accelerator-Z (AZ) proposals grouped into work packages, shows live Pillar votes read from a public node, and publishes the site owner's draft assessment. Deployed to GitHub Pages at `https://www.0x3639.com/Pillar-Stance/` via `.github/workflows/pages.yml` on every push to `main` (runs `npm ci`, `npm test`, `npm run build`).

## Commands

```sh
npm ci                       # install (lockfile-exact)
npm run dev                  # regenerate public/evaluate-the-work.txt, then vite dev on 127.0.0.1
npm run build                # regenerate the txt, then vite build -> dist/
npm run preview              # serve dist/
npm test                     # node --test tests/*.test.js (no test framework; node:test + node:assert/strict)
node --test tests/rpc.test.js                 # one file
node --test --test-name-pattern="quorum" tests/proposals.test.js   # one test by name
```

No linter or formatter is configured. Node 22 is used in CI.

`scripts/build-context.mjs` runs before both `dev` and `build`. It reads `src/data/site.json`, writes `public/evaluate-the-work.txt` (gitignored), and deletes any stale `public/briefs/`. If you edit `src/evaluation-context.js` or `site.json`, the txt only updates on the next `dev`/`build`.

Vite `base` is `/Pillar-Stance/` only when `GITHUB_ACTIONS` is set; locally it is `/`. Any asset URL built in JSX must use `import.meta.env.BASE_URL` (see `briefUrl` and the logo in `App.jsx`).

## Architecture

**Two data sources, deliberately kept separate:**

1. **Editorial config** — `src/data/site.json`. Holds tracked AZ IDs (grouped into `workPackages`), forum/repo/devnet links, per-package `stance` (`support` | `reject` | `null`), and the `assessment` (status must be `Draft` or `Published`). This is the only file to edit to change published content. It is validated at runtime by `configuredPackages()` in `src/published.js` (throws on bad URLs, duplicate IDs, mismatched `projectNames`/`projectIds` lengths, etc.) and the same validation runs in `tests/proposals.test.js` against the real JSON, so a bad edit fails `npm test`.

2. **Live vote data** — fetched in the browser from the node in `src/config.js` (`NODE_URL`). Nothing vote-related is bundled or persisted; a failed read keeps the previous in-session result visible.

**Pure logic modules (plain `.js`, importable from node tests without a DOM):**

- `src/rpc.js` — JSON-RPC `rpc()` plus `getAllPages()` which paginates `[page, 100]` until `list.length >= count` and throws on empty/over-long pagination.
- `src/live.js` — `loadLiveVotes(site, signal)`: fetches `embedded.accelerator.getAll` and `embedded.pillar.getAll`, filters active Pillars (`revokeTimestamp === 0`), then fans out `embedded.accelerator.getPillarVotes` per Pillar with a 6-worker pool. Validates every ballot shape and throws "Votes changed while reading" if per-Pillar counts exceed the aggregate tally. Returns `{ fetchedAt, nodeUrl, activePillars, projects, pillarVotes }` — this object is called the **snapshot** / `tracking` elsewhere.
- `src/proposals.js` — voting math and status. `votingTarget(project)` is the key abstraction: for an approved project (`status === 1`) with a phase in voting it returns that phase (with `isPhase: true`), otherwise the project itself. Every tally, ballot lookup and countdown goes through it so project ballots and phase ballots are never mixed. `voteMetrics` implements quorum = `floor(active * 33 / 100) + 1`, approval = `total >= quorum && yes > no`. Vote enum: `0=yes, 1=no, 2=abstain`.
- `src/published.js` — joins config to snapshot: `configuredPackages()` validates and attaches live projects to each work package; `packageVotes()` builds the per-Pillar ballot table for a package.
- `src/evaluation-context.js` — generates the shareable `evaluate-the-work.txt` from `site.json` alone. It must never include vote totals, voter names, status, or a snapshot date (the README promises this publicly).

**UI** — `src/App.jsx` is the whole page. It owns the fetch lifecycle (load on mount, 5-minute auto-refresh, manual refresh with `AbortController`), a 1-second `now` tick for countdowns, and the dark/light toggle (toggles the `dark` class on `<html>`; `index.html` starts with `class="dark"`).

**Styling** — `src/design-system/` is a vendored copy of the Zenon design system (MIT, see its `LICENSE`): CSS tokens under `tokens/`, primitives (`Button`, `Badge`, `Card`, `Input`, `Address`, `Amount`, `NetworkGlyph`). Treat it as upstream code; app-specific styles go in `src/styles.css`, which relies on the design-system CSS variables (`--foreground`, `--border`, `--font-mono`, ...). Fonts are self-hosted via `@fontsource` imports in `main.jsx`.

## Testing conventions

Tests mock the network by reassigning `globalThis.fetch` and restoring it in `finally`; they dispatch on the JSON-RPC `method` in the request body. Pass explicit `now` arguments to the time-dependent functions in `proposals.js` rather than relying on `Date.now()`.

## Domain rules worth knowing

- Voting window is 14 days from `creationTimestamp` (`VOTING_PERIOD`). Project ballots get a countdown; phase ballots do not, because the contract sets no phase deadline.
- Status enum indexes `STATUS_LABELS`: `0 Voting, 1 Approved, 2 Paid, 3 Closed, 4 Completed`. An unapproved project past its window shows "Awaiting closure" until the contract updates.
- Protocol source of truth for these rules: `go-zenon` `vm/embedded/implementation/accelerator.go` and `vm/constants/embedded.go`. Check there before changing `voteMetrics`.
