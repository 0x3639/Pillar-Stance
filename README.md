# Pillar Stance

A read-only Vite + React page for tracking selected Accelerator-Z work packages, their Pillar votes, and a published assessment. GitHub Pages serves the site at [0x3639.com/Pillar-Stance](https://www.0x3639.com/Pillar-Stance/).

## Run locally

```sh
npm ci
npm run dev
```

`npm test` checks the voting calculations, JSON configuration, named-ballot reconciliation, and RPC pagination. `npm run build` generates public LLM briefs and the static site in `dist/`. Pushing to `main` runs the tests and deploys the build through `.github/workflows/pages.yml`.

## Edit the published page

[`src/data/site.json`](src/data/site.json) is the editable source for tracked author labels, work-package names and order, proposal IDs and order, public work links, and the site owner's published stances. Each package has a `stance` of `"support"`, `"reject"`, or `null` and a `paragraphs` array of public rationale. `null` displays **Review pending**. Edit this file in GitHub or locally and commit it to publish the change. Do not put private notes in it; all its contents are public.

[`src/data/snapshot.json`](src/data/snapshot.json) is a committed snapshot from `https://my.hc1node.com:35997`. It contains the nine tracked AZ submissions, total votes, active-Pillar count, named ballots, and a `fetchedAt` timestamp. Update it locally with:

```sh
npm run refresh:snapshot
npm test
git add src/data/snapshot.json
git commit -m "Refresh AZ vote snapshot"
git push
```

The refresh script fetches every page of AZs and active Pillars, then checks each Pillar's votes for each tracked AZ. It validates IDs and tallies before replacing the existing snapshot; a failed or incomplete query leaves the old file intact. The site does not contact the node or save browser state. Vote totals and displayed statuses stay at the committed snapshot until another commit is deployed. Visitors can expand a package's **Pillar voting** table to inspect the recorded yes/no/abstain ballot per named Pillar. Pillars may change votes after the snapshot.

The [four supplied work repositories](src/data/site.json) appear as direct links in the site and in every package brief, alongside all AZ/forum links. `scripts/build-briefs.mjs` generates one plain-text brief per package under `/briefs/` during development and deployment. Copy its public URL into Claude or another LLM to request an independent review; it explicitly asks the model to inspect the relevant repositories and distinguish verified evidence from claims.

## Voting rules

Approval requires total participation **strictly greater than 33%** of active Pillars and **yes > no**. Abstentions count toward participation. With 97 active Pillars, quorum is 33. Additional yes needed is `max(0, quorum - total, no - yes + 1)`.

There is no immediate on-chain rejection threshold. “More no to block” is `max(0, quorum - total, yes - no)`: additional no votes to reach quorum with a tie or no majority, assuming existing ballots stay unchanged. Pillars may change votes. An unapproved project closes after its 14-day window when the contract updates. An approved project with a phase in voting shows the current phase's tally. These values and statuses are calculated against the snapshot timestamp, so they do not change in a visitor's browser.

Sources: [Accelerator implementation](https://github.com/zenon-network/go-zenon/blob/master/vm/embedded/implementation/accelerator.go), [contract constants](https://github.com/zenon-network/go-zenon/blob/master/vm/constants/embedded.go).

## Design system

Uses the supplied [Zenon design system](https://github.com/digitalSloth/zenon-design-system): semantic colors, plasma action/progress fill, ledger labels, Address/Amount/Button/NetworkGlyph primitives, official ZNN mark, and self-hosted Space Grotesk + JetBrains Mono fonts. Source copies and the upstream MIT license are in `src/design-system/`.
