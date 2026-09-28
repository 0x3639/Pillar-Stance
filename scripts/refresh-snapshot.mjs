import fs from 'node:fs/promises';
import { getAllPages, rpc } from '../src/rpc.js';
import { votingTarget } from '../src/proposals.js';

const site = JSON.parse(await fs.readFile(new URL('../src/data/site.json', import.meta.url)));
const projectIds = [...new Set(site.workPackages.flatMap(group => group.projectIds))];
const tracked = new Set(projectIds);
const [allProjects, pillars] = await Promise.all([
  getAllPages('embedded.accelerator.getAll', AbortSignal.timeout(60_000)),
  getAllPages('embedded.pillar.getAll', AbortSignal.timeout(60_000)),
]);
const projects = allProjects.filter(project => tracked.has(project.id));
if (projects.length !== tracked.size) throw new Error(`Only ${projects.length} of ${tracked.size} configured AZs were found; old snapshot preserved.`);
const activePillars = pillars.filter(pillar => pillar.revokeTimestamp === 0);
if (!activePillars.length) throw new Error('The node returned no active Pillars; old snapshot preserved.');
const hashes = projects.map(project => votingTarget(project).id);
const pillarVotes = Object.fromEntries(hashes.map(id => [id, []]));

// Each RPC request returns the named Pillar's ballot for every tracked AZ.
// A small worker pool avoids overwhelming the public node.
let index = 0;
async function worker() {
  while (index < activePillars.length) {
    const pillar = activePillars[index++];
    const ballots = await rpc('embedded.accelerator.getPillarVotes', [pillar.name, hashes], AbortSignal.timeout(30_000));
    if (!Array.isArray(ballots) || ballots.length !== hashes.length) throw new Error(`Incomplete votes for ${pillar.name}; old snapshot preserved.`);
    ballots.forEach((ballot, ballotIndex) => {
      if (ballot === null) return;
      if (ballot.id !== hashes[ballotIndex] || ballot.name !== pillar.name || ![0, 1, 2].includes(ballot.vote)) {
        throw new Error(`Invalid vote for ${pillar.name}; old snapshot preserved.`);
      }
      pillarVotes[ballot.id].push({ name: ballot.name, vote: ballot.vote });
    });
  }
}
await Promise.all(Array.from({ length: Math.min(6, activePillars.length) }, worker));
for (const project of projects) {
  const target = votingTarget(project);
  const ballots = pillarVotes[target.id];
  if (ballots.length > target.votes.total) throw new Error(`Vote count changed for ${project.name}; old snapshot preserved.`);
  const yes = ballots.filter(ballot => ballot.vote === 0).length;
  const no = ballots.filter(ballot => ballot.vote === 1).length;
  if (yes > target.votes.yes || no > target.votes.no) throw new Error(`Vote breakdown changed for ${project.name}; old snapshot preserved.`);
  ballots.sort((a, b) => a.name.localeCompare(b.name));
}
const snapshot = {
  fetchedAt: new Date().toISOString(),
  nodeUrl: 'https://my.hc1node.com:35997',
  activePillars: activePillars.length,
  projects,
  pillarVotes,
};
await fs.writeFile(new URL('../src/data/snapshot.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Saved ${projects.length} AZs and ${Object.values(pillarVotes).reduce((sum, ballots) => sum + ballots.length, 0)} named ballots at ${snapshot.fetchedAt}.`);
