import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLiveVotes } from '../src/live.js';

const site = { workPackages: [{ projectIds: ['az-a', 'az-b'] }] };
const projects = [
  { id: 'az-a', name: 'AZ A', status: 0, votes: { yes: 1, no: 1, total: 2 }, phases: [] },
  { id: 'az-b', name: 'AZ B', status: 0, votes: { yes: 1, no: 0, total: 1 }, phases: [] },
];
const pillars = [
  { name: 'Alice', revokeTimestamp: 0 },
  { name: 'Bob', revokeTimestamp: 0 },
  { name: 'Retired', revokeTimestamp: 123 },
];

test('live vote read queries the public node for totals and named active-Pillar ballots', async () => {
  const original = globalThis.fetch;
  const methods = [];
  globalThis.fetch = async (_, options) => {
    const { method, params } = JSON.parse(options.body);
    methods.push(method);
    let result;
    if (method === 'embedded.accelerator.getAll') result = { count: projects.length, list: projects };
    else if (method === 'embedded.pillar.getAll') result = { count: pillars.length, list: pillars };
    else if (method === 'embedded.accelerator.getPillarVotes') {
      const name = params[0];
      assert.deepEqual(params[1], ['az-a', 'az-b']);
      result = name === 'Alice' ? [{ id: 'az-a', name, vote: 0 }, { id: 'az-b', name, vote: 0 }] : [{ id: 'az-a', name, vote: 1 }, null];
    } else throw new Error(`Unexpected method ${method}`);
    return { ok: true, json: async () => ({ result }) };
  };
  try {
    const live = await loadLiveVotes(site);
    assert.equal(live.projects.length, 2);
    assert.equal(live.activePillars, 2);
    assert.deepEqual(live.pillarVotes['az-a'], [{ name: 'Alice', vote: 0 }, { name: 'Bob', vote: 1 }]);
    assert.deepEqual(live.pillarVotes['az-b'], [{ name: 'Alice', vote: 0 }]);
    assert.equal(methods.filter(method => method === 'embedded.accelerator.getPillarVotes').length, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test('incomplete public-node response fails instead of displaying bundled votes', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_, options) => {
    const { method } = JSON.parse(options.body);
    const result = method === 'embedded.accelerator.getAll' ? { count: 1, list: [projects[0]] } : { count: pillars.length, list: pillars };
    return { ok: true, json: async () => ({ result }) };
  };
  try { await assert.rejects(loadLiveVotes(site), /did not return configured AZ az-b/); }
  finally { globalThis.fetch = original; }
});
