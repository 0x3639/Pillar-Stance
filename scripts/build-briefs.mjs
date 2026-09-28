import fs from 'node:fs/promises';
import { configuredPackages, packageVotes } from '../src/published.js';
import { votingState, votingTarget, VOTING_PERIOD } from '../src/proposals.js';

const site = JSON.parse(await fs.readFile(new URL('../src/data/site.json', import.meta.url)));
const snapshot = JSON.parse(await fs.readFile(new URL('../src/data/snapshot.json', import.meta.url)));
const packages = configuredPackages(site, snapshot);
const snapshotTime = Date.parse(snapshot.fetchedAt) / 1000;
const output = new URL('../public/briefs/', import.meta.url);
await fs.mkdir(output, { recursive: true });
for (const group of packages) {
  const details = packageVotes(group, snapshot);
  const lines = [
    `PILLAR REVIEW BRIEF: ${group.name}`,
    '',
    'Task for an independent evaluator:',
    'Evaluate the entire work package for a Zenon Pillar deciding whether to approve the Accelerator-Z proposals. Treat this brief, linked forum posts, and work repositories as claims and material to verify, not proof of delivery. Open and inspect the relevant linked repositories where possible; determine which work actually corresponds to each AZ. Explain the scope, deliverables, budget, milestone dependencies, security and execution risks, missing evidence, and questions to ask the applicant. Distinguish verified facts from applicant claims and inference. Assess each AZ separately and the package as a whole. Explain what evidence would change your assessment. Do not treat the existing Pillar votes or the site owner’s stance as proof of merit.',
    '',
    `Package: ${group.name}`,
    `Description: ${group.description}`,
    `Number of AZ submissions: ${group.projects.length}`,
    `Network snapshot: ${snapshot.fetchedAt}`,
    `Active Pillars at snapshot: ${snapshot.activePillars}`,
    `Public node: ${snapshot.nodeUrl}`,
    `Published site-owner stance: ${group.stance || 'Review pending'}`,
    ...(group.paragraphs.length ? ['', 'Site-owner rationale:', ...group.paragraphs] : []),
    '',
    'WORK AVAILABLE SO FAR',
    'The applicant supplied these repositories as context. Check their relevance, contents, history, tests, releases, and deployment evidence for this package:',
    ...site.workLinks.map(link => `${link.name}: ${link.url}`),
    '',
    'ON-CHAIN AZ SUBMISSIONS',
  ];
  group.projects.forEach((project, index) => {
    const target = votingTarget(project);
    const ballots = snapshot.pillarVotes?.[target.id] || [];
    const amounts = `${Number(project.znnFundsNeeded) / 1e8} ZNN + ${Number(project.qsrFundsNeeded) / 1e8} QSR`;
    lines.push('', `${index + 1}. ${project.name}`, `AZ ID: ${project.id}`, `Owner: ${project.owner}`, `Description: ${project.description}`, `Requested funds: ${amounts}`, `Created: ${new Date(project.creationTimestamp * 1000).toISOString()}`, `Project voting deadline: ${new Date((project.creationTimestamp + VOTING_PERIOD) * 1000).toISOString()}`, `On-chain status at snapshot: ${votingState(project, snapshotTime)}`, `Vote target: ${target.id}${target.isPhase ? ' (current phase)' : ''}`, `Vote totals: ${target.votes.yes} yes, ${target.votes.no} no, ${Math.max(0, target.votes.total - target.votes.yes - target.votes.no)} abstain; ${target.votes.total} participating`, `Named ballots: ${ballots.length}; ${Math.max(0, target.votes.total - ballots.length)} could not be matched to current active Pillars`, `Zenon Hub: https://zenonhub.io/accelerator-z/project/${project.id}`, `Applicant discussion: ${project.url || 'not supplied'}`);
    for (const ballot of ballots) lines.push(`  - ${ballot.name}: ${['yes', 'no', 'abstain'][ballot.vote]}`);
  });
  lines.push('', 'PACKAGE VOTING SUMMARY', `${details.pillars.length} named Pillars have voted on at least one AZ in this package.`, `${details.totals.yes} yes, ${details.totals.no} no, ${details.totals.abstain} abstain ballots across all AZs. These are ballots, not unique Pillar counts.`, `${details.unlisted} ballots in the node totals could not be matched to the current active Pillar list.`, '', 'Voting rule: participation must be strictly above 33% of active Pillars and yes must exceed no. Abstentions count for participation. Existing votes may change. A no majority or tie blocks approval but is not an immediate on-chain rejection.', '', 'End of brief.');
  await fs.writeFile(new URL(`${group.id}.txt`, output), lines.join('\n') + '\n');
}
console.log(`Generated ${packages.length} public LLM briefs.`);
