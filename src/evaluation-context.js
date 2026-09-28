const explorer = id => `https://zenonhub.io/accelerator-z/project/${id}`;

export function buildEvaluationContext(site) {
  const lines = [
    'EVALUATE THE WORK — ZENON ACCELERATOR-Z',
    '',
    'Purpose',
    'Help a Zenon Pillar independently evaluate the complete set of AZ submissions below. This file contains stable identifiers, source links, a research method, and the site owner’s clearly labeled draft opinion. It deliberately contains no vote totals, voter names, current proposal status, or snapshot date. Obtain current facts from the linked sources before answering. After reading them, be ready to answer the Pillar’s follow-up questions about scope, evidence, risks, budgets, dependencies, and milestone acceptance. Do not treat the site owner’s assessment as independent evidence or recommend a vote unless asked.',
    '',
    'How to work',
    'Read each forum thread, including edits and newer replies, to learn the applicant’s latest scope, budget, milestones, acceptance criteria, and answers to criticism. Open the relevant source repositories and inspect code, history, tests, security notes, releases, and deployments. Check which repository actually supports each claimed deliverable. Try available demos only if your tools permit it. Distinguish applicant statements, directly observed evidence, and your inference. If a link or tool is inaccessible, say so and ask the Pillar for the missing material rather than treating it as verified.',
    '',
    'On-chain AZ filings and discussions',
  ];

  for (const group of site.workPackages) {
    lines.push('', `${group.name} — ${group.description}`, `Latest forum discussion: ${group.forumUrl}`);
    group.projectIds.forEach((id, index) => {
      lines.push(`- ${group.projectNames[index]}`, `  AZ ID: ${id}`, `  Current on-chain record: ${explorer(id)}`);
    });
  }

  lines.push(
    '',
    'Source repositories to inspect',
    ...site.workLinks.map(link => `${link.name}: ${link.url}`),
    '',
    'Running references to inspect, if available',
    'These links point to changing services. Check their present behavior; this file makes no uptime or completion claim.',
    ...site.devnetLinks.map(link => `${link.name}: ${link.url}`),
    'Network front door: https://zenon.foo/',
    '',
    `Site owner’s ${site.assessment.status.toLowerCase()} personal assessment (opinion, not independent verification)`,
    site.assessment.title,
    ...site.assessment.paragraphs.flatMap(paragraph => ['', paragraph]),
    '',
    'How to obtain current voting and proposal state',
    'Open each Zenon Hub on-chain record above for its latest status, funds requested, vote totals, and phases. Cross-check with the public Zenon JSON-RPC node at https://my.hc1node.com:35997. POST application/json with a JSON-RPC body such as:',
    '{"jsonrpc":"2.0","id":1,"method":"embedded.accelerator.getAll","params":[0,100]}',
    'Paginate by increasing the first parameter (0, 1, 2, ...) until the returned list covers count, then match the AZ IDs above. Read each project’s status and votes. If an approved project has a current voting phase, inspect its phase ID and phase votes separately; do not confuse a phase ballot with the original project ballot.',
    'For the active-Pillar denominator, paginate embedded.pillar.getAll with the same [page,100] parameters and include only Pillars whose revokeTimestamp is 0. To check named ballots, call embedded.accelerator.getPillarVotes with [pillarName,[AZ ID,...]] for each active Pillar (or the current phase IDs when evaluating a phase). Vote values are 0=yes, 1=no, 2=abstain; null means no recorded ballot. A Pillar may change a vote, so re-query before relying on a tally.',
    'The protocol’s voting rules should be checked against source: https://github.com/zenon-network/go-zenon/blob/master/vm/embedded/implementation/accelerator.go and https://github.com/zenon-network/go-zenon/blob/master/vm/constants/embedded.go. Do not use a copied tally or this file as a live vote feed.',
    '',
    'Questions to resolve for the Pillar',
    '- What has been delivered for each AZ and milestone, and what evidence independently demonstrates it?',
    '- What work remains, who is responsible for it, and which dependencies are outside the applicant’s control?',
    '- Do the repository history, tests, documentation, deployments, and demos support the forum claims?',
    '- For Ferry, what do the security review, remediation, refund paths, chain-specific HTLC behavior, and remaining audit work show?',
    '- For ZVM, can independent operators reproduce state through reorgs, is source available for review, and are asset exit/trust assumptions explained accurately?',
    '- For Pillar ownership transfer, what is the ZIP acceptance state, implementation evidence, and activation dependency?',
    '- Are the scope, requested funding, milestone gates, and user-facing risks clear enough for an informed decision?',
    'Present evidence and unresolved questions per AZ and for the connected stack as a whole. Keep your answer open to the Pillar’s follow-up questions.',
    '',
  );
  return lines.join('\n');
}
