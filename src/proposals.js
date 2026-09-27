export const VOTING_PERIOD = 14 * 24 * 60 * 60;
export const ACCEPTANCE_PERCENT = 33;
export const STATUS_LABELS = ['Voting', 'Approved', 'Paid', 'Closed', 'Completed'];

export function voteMetrics(votes, activePillars) {
  const { yes, no, total } = votes;
  const quorum = Math.floor(activePillars * ACCEPTANCE_PERCENT / 100) + 1;
  return {
    yes, no, total, quorum,
    abstain: Math.max(0, total - yes - no),
    uncast: Math.max(0, activePillars - total),
    participationNeeded: Math.max(0, quorum - total),
    yesNeeded: Math.max(0, quorum - total, no - yes + 1),
    noNeeded: Math.max(0, quorum - total, yes - no),
    meetsApproval: total >= quorum && yes > no,
  };
}

export function sequenceOf(project) {
  const match = project.name.match(/\((\d+)\/\d+\)/);
  return match ? Number(match[1]) : 0;
}

export function sortProjects(projects) {
  return [...projects].sort((a, b) => sequenceOf(a) - sequenceOf(b)
    || a.creationTimestamp - b.creationTimestamp
    || a.name.localeCompare(b.name, 'en', { numeric: true }) || a.id.localeCompare(b.id));
}

export function packageIdentity(project) {
  if (project.name.startsWith('Ferry:')) return { key: 'ferry', name: 'Ferry', description: 'Bitcoin & multi-chain swaps', icon: 'bridge' };
  if (/^ZVM\b/.test(project.name)) return { key: 'zvm', name: 'Zenoglyphs VM', description: 'An EVM metaprotocol for NoM', icon: 'layers' };
  return { key: project.id, name: project.name, description: project.description, icon: project.name.includes('Pillar') ? 'pillar' : project.name.includes('Syrius') ? 'wallet' : 'utilities' };
}

export function buildPackages(projects, owners, customGroups = []) {
  const groups = new Map();
  for (const project of projects) {
    const custom = customGroups.find(group => group.projectIds.includes(project.id));
    const identity = custom ? { key: custom.id, name: custom.name, description: 'Custom work package', icon: 'package' } : packageIdentity(project);
    const key = custom ? custom.id : `${project.owner}:${identity.key}`;
    if (!groups.has(key)) groups.set(key, { ...identity, key, owner: project.owner, ownerName: owners.find(owner => owner.address === project.owner)?.name || 'Tracked author', projects: [] });
    groups.get(key).projects.push(project);
  }
  return [...groups.values()].map(group => ({ ...group, projects: sortProjects(group.projects) }))
    .sort((a, b) => Math.max(...b.projects.map(p => p.creationTimestamp)) - Math.max(...a.projects.map(p => p.creationTimestamp))
      || b.projects.length - a.projects.length || a.name.localeCompare(b.name));
}

export function votingTarget(project) {
  if (project.status === 1) {
    const current = [...(project.phases || [])].sort((a, b) => b.phase.creationTimestamp - a.phase.creationTimestamp).find(p => p.phase.status === 0);
    if (current) return { ...current.phase, votes: current.votes, isPhase: true };
  }
  return { ...project, isPhase: false };
}

export function votingState(project, now = Date.now() / 1000) {
  const target = votingTarget(project);
  if (target.isPhase) return 'Phase voting';
  if (project.status === 0 && now > project.creationTimestamp + VOTING_PERIOD) return 'Awaiting closure';
  return STATUS_LABELS[project.status] || 'Unknown';
}

export function safeExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}
