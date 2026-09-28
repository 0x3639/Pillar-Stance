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
  if (project.status === 0 && now >= project.creationTimestamp + VOTING_PERIOD) return 'Awaiting closure';
  return STATUS_LABELS[project.status] || 'Unknown';
}

export function voteCountdown(project, now = Date.now() / 1000) {
  if (project.status !== 0) return null;
  const secondsLeft = Math.ceil(project.creationTimestamp + VOTING_PERIOD - now);
  if (secondsLeft <= 0) return null;
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor(secondsLeft % 86400 / 3600);
  const minutes = Math.floor(secondsLeft % 3600 / 60);
  const seconds = secondsLeft % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s left to vote`;
}

export function nextVoteDeadline(projects, now = Date.now() / 1000) {
  const deadlines = projects.filter(project => project.status === 0)
    .map(project => project.creationTimestamp + VOTING_PERIOD)
    .filter(deadline => deadline > now);
  return deadlines.length ? Math.min(...deadlines) : null;
}

export function safeExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}
