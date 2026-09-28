import { votingTarget } from './proposals.js';

export function configuredPackages(site, snapshot) {
  if (!Array.isArray(site.workLinks) || site.workLinks.some(link => !link.name || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(link.url))) {
    throw new Error('Invalid work links in site configuration');
  }
  const byId = new Map(snapshot.projects.map(project => [project.id, project]));
  const seen = new Set();
  return site.workPackages.map(group => {
    if (!/^[a-z0-9-]+$/.test(group.id) || !group.name || !['support', 'reject', null].includes(group.stance) || !Array.isArray(group.paragraphs)) {
      throw new Error(`Invalid work package configuration: ${group.id}`);
    }
    const projects = group.projectIds.map(id => {
      if (seen.has(id)) throw new Error(`Proposal ${id} appears in multiple work packages`);
      const project = byId.get(id);
      if (!project) throw new Error(`Configured proposal ${id} is missing from the node snapshot`);
      seen.add(id);
      return project;
    });
    if (!projects.length) throw new Error(`Work package ${group.id} has no proposals`);
    if (group.paragraphs.some(paragraph => typeof paragraph !== 'string')) throw new Error(`Invalid rationale in ${group.id}`);
    return { ...group, projects };
  });
}

export function packageVotes(group, snapshot) {
  const byName = new Map();
  let unlisted = 0;
  const totals = { yes: 0, no: 0, abstain: 0, total: 0 };
  for (const project of group.projects) {
    const target = votingTarget(project);
    const ballots = snapshot.pillarVotes?.[target.id] || [];
    totals.yes += target.votes.yes;
    totals.no += target.votes.no;
    totals.abstain += Math.max(0, target.votes.total - target.votes.yes - target.votes.no);
    totals.total += target.votes.total;
    unlisted += Math.max(0, target.votes.total - ballots.length);
    for (const ballot of ballots) {
      if (!byName.has(ballot.name)) byName.set(ballot.name, {});
      byName.get(ballot.name)[project.id] = ballot.vote;
    }
  }
  return {
    pillars: [...byName].map(([name, votes]) => ({ name, votes })).sort((a, b) => a.name.localeCompare(b.name)),
    totals,
    unlisted,
  };
}
