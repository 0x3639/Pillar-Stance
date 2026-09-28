# Pillar Stance

A Vite + React page for tracking Accelerator-Z work packages, current Pillar votes, a published draft assessment, and one shareable evaluation context. GitHub Pages serves the site at [0x3639.com/Pillar-Stance](https://www.0x3639.com/Pillar-Stance/).

## Run locally

```sh
npm ci
npm run dev
```

`npm test` checks the voting calculations, editorial configuration, evaluation context, live-node reading, and RPC pagination. `npm run build` generates `public/evaluate-the-work.txt` and the site in `dist/`. Pushing to `main` runs tests and deploys via `.github/workflows/pages.yml`.

## Published content

[`src/data/site.json`](src/data/site.json) holds the tracked AZ IDs and order, forum and repository links, demo links, package positions, and the site owner's draft assessment. Edit and commit it to change the published editorial content. The assessment is public and explicitly labeled **Draft**. The single [Evaluate the Work](https://www.0x3639.com/Pillar-Stance/evaluate-the-work.txt) file is generated from this JSON alone. It contains all nine AZ links, forum discussions, work repositories, the draft assessment, review questions, and instructions for fetching current votes. It does not contain vote totals, named ballots, a vote snapshot, or current project status.

## Live voting data

The page fetches **all displayed vote totals, named Pillar ballots, active-Pillar count, and AZ status directly from** `https://my.hc1node.com:35997`. It queries `embedded.accelerator.getAll`, `embedded.pillar.getAll`, and `embedded.accelerator.getPillarVotes`, paginating and checking the results before rendering them. The page reads on load, refreshes every five minutes while open, and offers a **Refresh votes** button for an immediate new read. The node read time appears beside the button. A failed read shows an error; if an earlier read succeeded in the same session, that last node result remains visible with its time. No vote data is bundled from GitHub JSON or saved to browser storage.

Visitors can expand each package's **Pillar voting** table to inspect the latest yes/no/abstain ballot per named Pillar. Pillars may change ballots between reads. The quote loader appears while the node is queried.

## Voting rules

Approval requires total participation **strictly greater than 33%** of active Pillars and **yes > no**. Abstentions count toward participation. Additional yes needed is `max(0, quorum - total, no - yes + 1)`.

There is no immediate on-chain rejection threshold. “More no to block” is `max(0, quorum - total, yes - no)`: additional no votes to reach quorum with a tie or no majority, assuming existing ballots stay unchanged. An unapproved project closes after its 14-day window when the contract updates. An approved project with a phase in voting shows the current phase's tally.

Open project ballots show a time-left countdown based on their on-chain creation timestamp and 14-day voting window; it updates while the page is open. Phase ballots do not show a countdown because the contract does not set a fixed phase-voting deadline.

Sources: [Accelerator implementation](https://github.com/zenon-network/go-zenon/blob/master/vm/embedded/implementation/accelerator.go), [contract constants](https://github.com/zenon-network/go-zenon/blob/master/vm/constants/embedded.go).

## Design system

Uses the supplied [Zenon design system](https://github.com/digitalSloth/zenon-design-system): semantic colors, plasma action/progress fill, ledger labels, Address/Amount/Button/NetworkGlyph primitives, official ZNN mark, and self-hosted Space Grotesk + JetBrains Mono fonts. Source copies and the upstream MIT license are in `src/design-system/`.
