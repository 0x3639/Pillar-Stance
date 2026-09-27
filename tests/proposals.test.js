import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPackages, voteMetrics, votingState, votingTarget, VOTING_PERIOD, safeExternalUrl } from '../src/proposals.js';
import { DEFAULT_OWNERS } from '../src/config.js';
import { remainingCacheTime } from '../src/cache.js';
const snapshot = JSON.parse(fs.readFileSync(new URL('../src/data/snapshot.json', import.meta.url)));

test('all nine submissions are grouped and numbered Ferry 1–3 then ZVM 1–3', () => {
  const packages = buildPackages(snapshot.projects, DEFAULT_OWNERS);
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

test('custom packages do not duplicate proposals', () => {
  const ids = snapshot.projects.slice(0, 2).map(p => p.id);
  const packages = buildPackages(snapshot.projects, DEFAULT_OWNERS, [{ id: 'custom', name: 'Combined', projectIds: ids }]);
  assert.equal(packages.find(p => p.key === 'custom').projects.length, 2);
  assert.equal(new Set(packages.flatMap(p => p.projects.map(p => p.id))).size, 9);
});

test('cache is reusable until exactly five minutes and rejects future or invalid timestamps', () => {
  const now = Date.parse('2026-09-27T12:00:00Z');
  assert.equal(remainingCacheTime({ fetchedAt: new Date(now).toISOString() }, now), 300_000);
  assert.equal(remainingCacheTime({ fetchedAt: new Date(now - 299_999).toISOString() }, now), 1);
  assert.equal(remainingCacheTime({ fetchedAt: new Date(now - 300_000).toISOString() }, now), 0);
  assert.equal(remainingCacheTime({ fetchedAt: new Date(now + 1).toISOString() }, now), 0);
  assert.equal(remainingCacheTime({ fetchedAt: 'bad' }, now), 0);
});

test('proposal links accept only web URLs', () => {
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('https://forum.zenon.org/t/test/1'), 'https://forum.zenon.org/t/test/1');
});
