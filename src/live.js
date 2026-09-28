import { NODE_URL } from './config.js';
import { votingTarget } from './proposals.js';
import { getAllPages, rpc } from './rpc.js';

export async function loadLiveVotes(site, signal) {
  const ids = [...new Set(site.workPackages.flatMap(group => group.projectIds))];
  const [allProjects, allPillars] = await Promise.all([
    getAllPages('embedded.accelerator.getAll', signal),
    getAllPages('embedded.pillar.getAll', signal),
  ]);
  const byId = new Map(allProjects.map(project => [project.id, project]));
  const projects = ids.map(id => {
    const project = byId.get(id);
    if (!project) throw new Error(`The public node did not return configured AZ ${id}.`);
    if (!project.votes || ![project.votes.yes, project.votes.no, project.votes.total].every(value => Number.isInteger(value) && value >= 0)) {
      throw new Error(`The public node returned incomplete voting data for ${project.name}.`);
    }
    return project;
  });
  const active = allPillars.filter(pillar => Number(pillar.revokeTimestamp) === 0);
  if (!active.length) throw new Error('The public node returned no active Pillars.');

  const hashes = projects.map(project => votingTarget(project).id);
  const pillarVotes = Object.fromEntries(hashes.map(id => [id, []]));
  let index = 0;
  async function worker() {
    while (index < active.length) {
      const pillar = active[index++];
      const ballots = await rpc('embedded.accelerator.getPillarVotes', [pillar.name, hashes], signal);
      if (!Array.isArray(ballots) || ballots.length !== hashes.length) throw new Error(`Incomplete Pillar ballots for ${pillar.name}.`);
      ballots.forEach((ballot, ballotIndex) => {
        if (ballot === null) return;
        if (ballot.id !== hashes[ballotIndex] || ballot.name !== pillar.name || ![0, 1, 2].includes(ballot.vote)) {
          throw new Error(`Invalid Pillar ballot for ${pillar.name}.`);
        }
        pillarVotes[ballot.id].push({ name: ballot.name, vote: ballot.vote });
      });
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, active.length) }, worker));
  for (const project of projects) {
    const target = votingTarget(project);
    const ballots = pillarVotes[target.id];
    const yes = ballots.filter(ballot => ballot.vote === 0).length;
    const no = ballots.filter(ballot => ballot.vote === 1).length;
    if (ballots.length > target.votes.total || yes > target.votes.yes || no > target.votes.no) {
      throw new Error(`Votes changed while reading ${project.name}. Please refresh again.`);
    }
    ballots.sort((a, b) => a.name.localeCompare(b.name));
  }
  return { fetchedAt: new Date().toISOString(), nodeUrl: NODE_URL, activePillars: active.length, projects, pillarVotes };
}
