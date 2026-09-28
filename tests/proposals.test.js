import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { voteMetrics, votingState, votingTarget, VOTING_PERIOD, safeExternalUrl } from '../src/proposals.js';
import { configuredPackages, packageVotes } from '../src/published.js';
const snapshot = JSON.parse(fs.readFileSync(new URL('../src/data/snapshot.json', import.meta.url)));
const site = JSON.parse(fs.readFileSync(new URL('../src/data/site.json', import.meta.url)));

test('GitHub JSON defines nine submissions grouped and ordered Ferry 1–3 then ZVM 1–3', () => {
  const packages = configuredPackages(site, snapshot);
  assert.equal(packages.length, 5);
  assert.equal(packages.flatMap(p => p.projects).length, 9);
  assert.deepEqual(packages[0].projects.map(p => p.name), ['Ferry: BTC Swaps (1/3)', 'Ferry: BTC Swaps (2/3)', 'Ferry: Multi-chain Swaps (3/3)']);
  assert.deepEqual(packages[1].projects.map(p => p.name), ['ZVM (1/3)', 'ZVM (2/3)', 'ZVM (3/3)']);
});

test('quorum is strictly above 33%, and abstentions count for participation', () => {
  assert.equal(voteMetrics({ yes: 1, no: 0, total: 1 }, 100).quorum, 34);
  const result = voteMetrics({ yes: 2, no: 1, total: 33 }, 97);
  assert.equal(result.abstain, 30);
  assert.equal(result.meetsApproval, true);
  assert.equal(result.yesNeeded, 0);
  assert.equal(result.noNeeded, 1);
});

test('more yes accounts for both quorum and a strict yes majority', () => {
  assert.equal(voteMetrics({ yes: 2, no: 0, total: 2 }, 97).yesNeeded, 31);
  assert.equal(voteMetrics({ yes: 10, no: 25, total: 35 }, 97).yesNeeded, 16);
  assert.equal(voteMetrics({ yes: 17, no: 17, total: 34 }, 97).yesNeeded, 1);
});

test('no-to-block is a tie at quorum, not a fictional rejection threshold', () => {
  assert.equal(voteMetrics({ yes: 2, no: 0, total: 2 }, 97).noNeeded, 31);
  assert.equal(voteMetrics({ yes: 25, no: 10, total: 35 }, 97).noNeeded, 15);
  assert.equal(voteMetrics({ yes: 17, no: 17, total: 34 }, 97).noNeeded, 0);
});

test('expired projects await on-chain closure, while current phases use phase votes', () => {
  const project = snapshot.projects[0];
  assert.equal(votingState(project, project.creationTimestamp + VOTING_PERIOD + 1), 'Awaiting closure');
  assert.equal(votingState({ ...project, status: 3 }), 'Closed');
  const phase = { phase: { id: 'phase', name: 'Phase 1', status: 0, creationTimestamp: 100 }, votes: { yes: 4, no: 1, total: 5 } };
  const active = { ...project, status: 1, phases: [phase] };
  assert.equal(votingTarget(active).id, 'phase');
  assert.equal(votingTarget(active).votes.yes, 4);
  assert.equal(votingState(active), 'Phase voting');
});

test('published packages reject duplicate or missing AZ IDs', () => {
  const duplicate = structuredClone(site);
  duplicate.workPackages[1].projectIds.push(duplicate.workPackages[0].projectIds[0]);
  assert.throws(() => configuredPackages(duplicate, snapshot), /multiple work packages/);
  const missing = structuredClone(site);
  missing.workPackages[0].projectIds[0] = 'missing';
  assert.throws(() => configuredPackages(missing, snapshot), /missing from the node snapshot/);
});

test('named Pillar ballots reconcile with each AZ tally in the snapshot', () => {
  for (const group of configuredPackages(site, snapshot)) {
    const summary = packageVotes(group, snapshot);
    assert.ok(summary.pillars.length <= snapshot.activePillars);
    assert.equal(summary.totals.total, summary.totals.yes + summary.totals.no + summary.totals.abstain);
    assert.ok(summary.unlisted >= 0);
    for (const project of group.projects) {
      const target = votingTarget(project);
      const ballots = snapshot.pillarVotes[target.id];
      assert.ok(Array.isArray(ballots));
      assert.ok(ballots.length <= target.votes.total);
      assert.ok(ballots.filter(ballot => ballot.vote === 0).length <= target.votes.yes);
      assert.ok(ballots.filter(ballot => ballot.vote === 1).length <= target.votes.no);
    }
  }
});

test('all four supplied work repositories appear in the published LLM context', () => {
  assert.deepEqual(site.workLinks.map(link => link.url), [
    'https://github.com/sol-znn/ferry-web',
    'https://github.com/sol-znn/zenon-faucet',
    'https://github.com/sol-znn/syrius-extension',
    'https://github.com/sol-znn/landing_page',
  ]);
});

test('proposal links accept only web URLs', () => {
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('https://forum.zenon.org/t/test/1'), 'https://forum.zenon.org/t/test/1');
});
