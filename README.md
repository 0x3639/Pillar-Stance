# Pillar Stance

A Vite + React landing page for Accelerator-Z tracking and personal support/reject decisions. Hosted on GitHub Pages at https://0x3639.github.io/Pillar-Stance/.

## Run locally

```sh
npm ci
npm run dev
```

`npm test` checks voting rules, package ordering, cache expiry, and RPC pagination. `npm run build` produces `dist/`. Pushing to `main` runs the tests and deploys the build through `.github/workflows/pages.yml`.

## Tracking and data

- Public JSON-RPC: `https://my.hc1node.com:35997` (HTTPS and cross-origin requests are supported).
- `src/config.js` lists the default tracked authors. The page loads **all** paginated AZ submissions, then filters by owner.
- The initial address has nine submissions from September 25, 2026. Ferry and ZVM are grouped and sorted 1 → 2 → 3. Standalone proposals follow in alphabetical order when submission dates match.
- Results are cached in localStorage for five minutes per set of tracked addresses. Reloading reuses fresh data. Expiry automatically refreshes while the page is open. Manual refresh bypasses the cache. Errors retain the last snapshot and show its timestamp; no data is labeled live when unavailable.
- A refresh types “Don’t Trust. Verify” in 25 ms steps, then animates four thinking dots. Reduced-motion preferences show a static quote and dots.
- `src/data/snapshot.json` is a real initial node snapshot, visibly labeled as a snapshot until a live read succeeds. Update it with `npm run refresh:snapshot`.
- Manage tracking adds/removes authors and groups any proposals into custom work packages. Settings persist in this browser; editing `src/config.js` changes the shared defaults.

## Voting rules

Approval requires total participation **strictly greater than 33%** of active Pillars and **yes > no**. Abstentions count toward participation. With 97 active Pillars, quorum is 33. Additional yes needed is `max(0, quorum - total, no - yes + 1)`.

There is no immediate on-chain rejection threshold. “More no to block” is `max(0, quorum - total, yes - no)`: additional no votes to reach quorum with a tie or no majority. Existing votes are assumed unchanged. Pillars may change votes. An unapproved project closes after its 14-day window when the contract updates. An approved project with a phase in voting shows the current phase’s tally. Status comes from the public node.

Sources: [Accelerator implementation](https://github.com/zenon-network/go-zenon/blob/master/vm/embedded/implementation/accelerator.go), [contract constants](https://github.com/zenon-network/go-zenon/blob/master/vm/constants/embedded.go).

## Personal opinions

Support/reject and reasoning are saved **locally on this device** per proposal; they can be applied to a whole package, changed, cleared, or exported to JSON. They are not published and do not submit Pillar votes. GitHub Pages provides static hosting; a public discussion service or wallet integration would require a separate implementation.

## Design system

Uses the supplied [Zenon design system](https://github.com/digitalSloth/zenon-design-system): semantic colors, plasma action/progress fill, ledger labels, actual Address/Amount/Button/NetworkGlyph primitives, official ZNN mark, and self-hosted Space Grotesk + JetBrains Mono fonts. Source copies and the upstream MIT license are in `src/design-system/`. Address clipboard handling was adjusted to report success only after the copy completes.
