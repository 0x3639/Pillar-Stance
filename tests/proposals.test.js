import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { voteCountdown, voteMetrics, votingState, votingTarget, VOTING_PERIOD, safeExternalUrl } from '../src/proposals.js';
import { configuredPackages, packageVotes } from '../src/published.js';
import { buildEvaluationContext } from '../src/evaluation-context.js';

const site = JSON.parse(fs.readFileSync(new URL('../src/data/site.json', import.meta.url)));
const projects = site.workPackages.flatMap(group => group.projectIds.map((id, index) => ({
  id,
  name: group.projectNames[index],
  owner: site.trackedOwners[0].address,
  creationTimestamp: 1000,
  status: 0,
  votes: { yes: 1, no: 0, total: 1 },
  phases: [],
})));
const tracking = {
  activePillars: 97,
  projects,
  pillarVotes: Object.fromEntries(projects.map(project => [project.id, [{ name: 'test-pillar', vote: 0 }]])),
};

test('editorial JSON defines all nine AZs in Ferry 1–3 then ZVM 1–3 order', () => {
  const packages = configuredPackages(site, tracking);
  assert.equal(packages.length, 5);
  assert.equal(packages.flatMap(group => group.projects).length, 9);
  assert.deepEqual(packages[0].projects.map(project => project.name), ['Ferry: BTC Swaps (1/3)', 'Ferry: BTC Swaps (2/3)', 'Ferry: Multi-chain Swaps (3/3)']);
  assert.deepEqual(packages[1].projects.map(project => project.name), ['ZVM (1/3)', 'ZVM (2/3)', 'ZVM (3/3)']);
  assert.ok(packages.every(group => group.stance === 'support'));
});

test('quorum is strictly above 33%, and abstentions count for participation', () => {
  assert.equal(voteMetrics({ yes: 1, no: 0, total: 1 }, 100).quorum, 34);
  const result = voteMetrics({ yes: 2, no: 1, total: 33 }, 97);
  assert.equal(result.abstain, 30);
  assert.equal(result.meetsApproval, true);
  assert.equal(result.yesNeeded, 0);
  assert.equal(result.noNeeded, 1);
});

test('more yes accounts for quorum and a strict yes majority', () => {
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
  const project = projects[0];
  assert.equal(votingState(project, project.creationTimestamp + VOTING_PERIOD + 1), 'Awaiting closure');
  assert.equal(votingState({ ...project, status: 3 }), 'Closed');
  const phase = { phase: { id: 'phase', name: 'Phase 1', status: 0, creationTimestamp: 100 }, votes: { yes: 4, no: 1, total: 5 } };
  const active = { ...project, status: 1, phases: [phase] };
  assert.equal(votingTarget(active).id, 'phase');
  assert.equal(votingTarget(active).votes.yes, 4);
  assert.equal(votingState(active), 'Phase voting');
});

test('vote countdown follows the project deadline and omits phases without a fixed deadline', () => {
  const project = projects[0];
  const deadline = project.creationTimestamp + VOTING_PERIOD;
  assert.equal(voteCountdown(project, deadline - 2 * 86400 - 3 * 3600), '2 days 3h left to vote');
  assert.equal(voteCountdown(project, deadline - 35 * 60), '35m left to vote');
  assert.equal(voteCountdown(project, deadline), null);
  assert.equal(votingState(project, deadline), 'Awaiting closure');
  assert.equal(voteCountdown({ ...project, status: 1, phases: [{ phase: { id: 'phase', status: 0, creationTimestamp: 2000 }, votes: { yes: 0, no: 0, total: 0 } }] }, deadline - 86400), null);
});

test('configuration rejects duplicate or missing AZ IDs', () => {
  const duplicate = structuredClone(site);
  duplicate.workPackages[1].projectIds.push(duplicate.workPackages[0].projectIds[0]);
  duplicate.workPackages[1].projectNames.push('Duplicate');
  assert.throws(() => configuredPackages(duplicate, tracking), /multiple work packages/);
  const missing = structuredClone(site);
  missing.workPackages[0].projectIds[0] = 'missing';
  assert.throws(() => configuredPackages(missing, tracking), /missing from the public node response/);
});

test('package voting summary uses the supplied node ballots', () => {
  const summary = packageVotes(configuredPackages(site, tracking)[0], tracking);
  assert.deepEqual(summary.totals, { yes: 3, no: 0, abstain: 0, total: 3 });
  assert.deepEqual(summary.pillars.map(pillar => pillar.name), ['test-pillar']);
  assert.equal(summary.unlisted, 0);
});

test('one evaluation context includes every AZ, forum, repository, and the draft assessment without vote results', () => {
  const context = buildEvaluationContext(site);
  for (const group of site.workPackages) {
    assert.ok(context.includes(group.forumUrl));
    for (const id of group.projectIds) assert.ok(context.includes(id));
  }
  for (const link of site.workLinks) assert.ok(context.includes(link.url));
  assert.ok(context.includes(site.assessment.paragraphs[0]));
  assert.ok(context.includes('embedded.accelerator.getPillarVotes'));
  assert.doesNotMatch(context, /Vote totals:|Named ballots:|Network snapshot:|2026-09-28T|41 named ballots/);
});

test('proposal links accept only web URLs', () => {
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('https://forum.zenon.org/t/test/1'), 'https://forum.zenon.org/t/test/1');
});
