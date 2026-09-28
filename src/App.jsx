import { useState } from 'react';
import { ArrowUpRight, Check, CheckCircle2, ChevronRight, Clock3, Copy, ExternalLink, FileText, Layers3, Moon, Package, ShieldCheck, Sun, ThumbsDown, ThumbsUp, Wallet, Wrench, X } from 'lucide-react';
import { Button } from './design-system/components/core/Button';
import { Address } from './design-system/components/blockchain/Address';
import { Amount } from './design-system/components/blockchain/Amount';
import { NetworkGlyph } from './design-system/components/blockchain/NetworkGlyph';
import { NODE_URL } from './config';
import { configuredPackages, packageVotes } from './published';
import { safeExternalUrl, sequenceOf, VOTING_PERIOD, voteMetrics, votingState, votingTarget } from './proposals';
import site from './data/site.json';
import snapshot from './data/snapshot.json';

const packages = configuredPackages(site, snapshot);
const projects = packages.flatMap(group => group.projects);
const snapshotTime = Date.parse(snapshot.fetchedAt) / 1000;
const shortDate = timestamp => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(timestamp * 1000));
const dateTime = iso => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const tokenAmount = (entries, token) => Number(entries.reduce((sum, project) => sum + BigInt(project[token] || 0), 0n)) / 1e8;
const briefUrl = group => `${import.meta.env.BASE_URL}briefs/${group.id}.txt`;

function PackageIcon({ type }) {
  if (['bridge', 'pillar'].includes(type)) return <NetworkGlyph name={type} size={22} />;
  const Icon = { layers: Layers3, wallet: Wallet, utilities: Wrench, package: Package }[type] || Package;
  return <Icon size={20} aria-hidden="true" />;
}

function StatusBadge({ project }) {
  const state = votingState(project, snapshotTime);
  const isOpen = ['Voting', 'Phase voting'].includes(state);
  const isClosed = ['Closed', 'Awaiting closure'].includes(state);
  const Icon = isOpen || isClosed ? Clock3 : CheckCircle2;
  return <span className={`status-badge ${isOpen ? 'voting' : isClosed ? 'closed' : 'approved'}`}><Icon size={13} aria-hidden="true" />{state}</span>;
}

function VoteSummary({ project }) {
  const target = votingTarget(project);
  const metrics = voteMetrics(target.votes, snapshot.activePillars);
  const state = votingState(project, snapshotTime);
  const isOpen = ['Voting', 'Phase voting'].includes(state);
  const filled = Math.min(100, metrics.total / metrics.quorum * 100);
  const yesWidth = metrics.total ? filled * metrics.yes / metrics.total : 0;
  const noWidth = metrics.total ? filled * metrics.no / metrics.total : 0;
  const abstainWidth = Math.max(0, filled - yesWidth - noWidth);
  return <div className="vote-summary">
    <div className="vote-counts"><span className="yes"><Check size={13} /> <strong>{metrics.yes}</strong> yes</span><span className="no"><X size={13} /> <strong>{metrics.no}</strong> no</span><span className="abstain"><strong>{metrics.abstain}</strong> abstain</span></div>
    <div className="vote-bar" role="progressbar" aria-label={`${project.name} participation`} aria-valuemin={0} aria-valuemax={metrics.quorum} aria-valuenow={Math.min(metrics.total, metrics.quorum)} aria-valuetext={`${metrics.yes} yes, ${metrics.no} no, ${metrics.abstain} abstain. ${metrics.total} of ${metrics.quorum} votes needed for quorum.`}>
      <span className="yes-fill" style={{ width: `${yesWidth}%` }} /><span className="no-fill" style={{ width: `${noWidth}%` }} /><span className="abstain-fill" style={{ width: `${abstainWidth}%` }} />
    </div>
    <div className="vote-caption"><span><b>{metrics.total}</b> / <b>{metrics.quorum}</b> quorum</span><span><b>{metrics.uncast}</b> uncast</span></div>
    {isOpen ? <div className="votes-needed"><span className="yes" title="Additional yes votes needed for quorum and a yes majority, if existing votes stay unchanged."><strong>{metrics.yesNeeded}</strong> more yes to approve</span><span title="Additional no votes to reach quorum and block a yes majority; this does not close voting."><strong>{metrics.noNeeded}</strong> more no to block</span></div> : <div className="votes-needed settled">{state === 'Awaiting closure' ? 'Voting period ended · awaiting node update' : state === 'Closed' ? 'Closed on-chain' : 'Project approval complete'}{target.isPhase && ' · phase tally shown'}</div>}
  </div>;
}

function ProposalRow({ project }) {
  const target = votingTarget(project);
  const discussion = safeExternalUrl(project.url);
  const deadline = project.creationTimestamp + VOTING_PERIOD;
  return <article className="proposal-row">
    <div className="proposal-info">
      <div className="proposal-title"><span className="sequence">{sequenceOf(project) ? String(sequenceOf(project)).padStart(2, '0') : <FileText size={15} />}</span><h3>{project.name}</h3><StatusBadge project={project} /></div>
      <p>{project.description}</p>
      <div className="proposal-metadata"><span className="funding"><Amount value={Number(project.znnFundsNeeded) / 1e8} decimals={0} symbol="ZNN" /><span className="separator">/</span><Amount value={Number(project.qsrFundsNeeded) / 1e8} decimals={0} symbol="QSR" /></span><span className="deadline" title={new Date(deadline * 1000).toISOString()}><Clock3 size={12} />{target.isPhase ? `Phase submitted ${shortDate(target.creationTimestamp)} UTC` : `Voting ends ${shortDate(deadline)} UTC`}</span></div>
    </div>
    <VoteSummary project={project} />
    <div className="proposal-actions"><a className="explorer-link" href={`https://zenonhub.io/accelerator-z/project/${project.id}`} target="_blank" rel="noreferrer">Zenon Hub <ArrowUpRight size={14} /></a>{discussion && <a className="discussion-link" href={discussion} target="_blank" rel="noreferrer">Discussion <ArrowUpRight size={12} /></a>}</div>
  </article>;
}

function Ballot({ vote }) {
  if (vote === undefined) return <span className="ballot uncast">—</span>;
  const label = ['Yes', 'No', 'Abstain'][vote] || 'Unknown';
  return <span className={`ballot ${label.toLowerCase()}`}>{label}</span>;
}

function PillarVotes({ group }) {
  const { pillars, totals, unlisted } = packageVotes(group, snapshot);
  return <details className="pillar-votes">
    <summary><span className="pillar-vote-heading"><ShieldCheck size={16} /><strong>Pillar voting</strong><span>{pillars.length} named Pillar{pillars.length === 1 ? '' : 's'} · {totals.yes} yes / {totals.no} no / {totals.abstain} abstain ballots</span></span><ChevronRight size={16} className="details-chevron" /></summary>
    <div className="pillar-vote-body"><p>Latest recorded ballot for each AZ as of {dateTime(snapshot.fetchedAt)}. A Pillar can change its vote.</p>
      {pillars.length ? <div className="ballot-table-scroll"><table className="ballot-table"><thead><tr><th scope="col">Pillar</th>{group.projects.map(project => <th scope="col" key={project.id}>{project.name}</th>)}</tr></thead><tbody>{pillars.map(pillar => <tr key={pillar.name}><th scope="row">{pillar.name}</th>{group.projects.map(project => <td key={project.id}><Ballot vote={pillar.votes[project.id]} /></td>)}</tr>)}</tbody></table></div> : <p className="empty-voters">No named Pillar votes in this snapshot.</p>}
      {unlisted > 0 && <p className="unlisted-note">{unlisted} ballot{unlisted === 1 ? '' : 's'} in the node totals could not be matched to the current active Pillar list.</p>}
    </div>
  </details>;
}

function WorkPackage({ group }) {
  const voting = group.projects.filter(project => ['Voting', 'Phase voting'].includes(votingState(project, snapshotTime))).length;
  return <section className="work-package" aria-labelledby={`package-${group.id}`}>
    <header className="package-header"><div className="package-heading"><span className="package-icon"><PackageIcon type={group.icon} /></span><div><div className="package-title"><h2 id={`package-${group.id}`}>{group.name}</h2><span className="package-count">{group.projects.length} AZ{group.projects.length > 1 ? 's' : ''}</span></div><p>{group.description}</p></div></div><div className="package-total"><span className="ledger">Package request</span><Amount value={tokenAmount(group.projects, 'znnFundsNeeded')} decimals={0} symbol="ZNN" /></div><div className="package-state"><span className="small-status"><Clock3 size={13} />{voting ? `${voting} in voting` : 'Voting complete'}</span><span className="ledger">{shortDate(group.projects[0].creationTimestamp)} submission</span></div></header>
    {group.projects.map(project => <ProposalRow key={project.id} project={project} />)}
    <PillarVotes group={group} />
  </section>;
}

function StanceBadge({ stance }) {
  if (stance === 'support') return <span className="editorial-stance support"><ThumbsUp size={15} /> Support</span>;
  if (stance === 'reject') return <span className="editorial-stance reject"><ThumbsDown size={15} /> Reject</span>;
  return <span className="editorial-stance pending"><Clock3 size={15} /> Review pending</span>;
}

function Assessment() {
  return <section id="assessment" className="assessment-section"><div className="section-heading"><div><span className="ledger section-eyebrow">Published position</span><h2>My assessment</h2><p>Positions and reasoning are published from the repository’s editorial JSON.</p></div></div>
    <div className="assessment-list">{packages.map(group => <article key={group.id} className="assessment-card"><div className="assessment-card-head"><div className="assessment-title"><span className="package-icon"><PackageIcon type={group.icon} /></span><div><span className="ledger">{group.projects.length} AZ{group.projects.length === 1 ? '' : 's'} in this package</span><h3>{group.name}</h3></div></div><StanceBadge stance={group.stance} /></div><div className="assessment-copy">{group.paragraphs.length ? group.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="pending-copy">Editorial assessment forthcoming.</p>}</div></article>)}</div>
  </section>;
}

function LlmBriefs() {
  const [copied, setCopied] = useState(null);
  async function copyBrief(group) {
    try {
      await navigator.clipboard.writeText(new URL(briefUrl(group), window.location.origin).href);
      setCopied(group.id);
    } catch { setCopied(null); }
  }
  return <section id="ai-briefs" className="brief-section"><div className="section-heading"><div><span className="ledger section-eyebrow">Independent review</span><h2>Evaluate a work package</h2><p>Give an LLM the brief link for the package you want to assess. Each brief includes every AZ, funding request, discussion link, available work repository, voting status, and named Pillar ballot in the snapshot.</p></div></div><div className="brief-list">{packages.map(group => <article className="brief-card" key={group.id}><span className="package-icon"><PackageIcon type={group.icon} /></span><div><h3>{group.name}</h3><p>{group.projects.length} AZ{group.projects.length === 1 ? '' : 's'} · {group.description}</p></div><div className="brief-actions"><button type="button" onClick={() => copyBrief(group)}><Copy size={15} />{copied === group.id ? 'Copied' : 'Copy link'}</button><a href={briefUrl(group)} target="_blank" rel="noreferrer">Open brief <ExternalLink size={15} /></a></div></article>)}</div><div className="work-links"><span className="ledger">Work available so far</span><div>{site.workLinks.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.name}<ArrowUpRight size={13} /></a>)}</div></div><p className="brief-footnote">The brief asks the LLM to verify claims against the linked proposals and inspect relevant work before recommending a vote. Network facts reflect the snapshot from {dateTime(snapshot.fetchedAt)}.</p></section>;
}

export default function App() {
  const [theme, setTheme] = useState('dark');
  const votingProjects = projects.filter(project => ['Voting', 'Phase voting'].includes(votingState(project, snapshotTime)));
  const quorum = Math.floor(snapshot.activePillars * 33 / 100) + 1;
  function toggleTheme() { const next = theme === 'dark' ? 'light' : 'dark'; document.documentElement.classList.toggle('dark', next === 'dark'); setTheme(next); }
  return <>
    <a href="#tracker" className="skip-link">Skip to proposals</a>
    <header className="site-header"><div className="header-inner"><a href="#" className="brand" aria-label="Pillar Stance home"><NetworkGlyph name="pillar" size={30} /><span>Pillar<span className="brand-divider">/</span><strong>Stance</strong></span></a><nav aria-label="Main navigation"><a href="#tracker" className="active">AZ tracker</a><a href="#assessment">My assessment</a><a href="#ai-briefs">LLM briefs</a></nav><div className="header-tools"><span className="node-status cached" title={`Snapshot source: ${NODE_URL}`}><span className="status-dot" />Node snapshot</span><Button variant="ghost" size="icon" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>{theme === 'dark' ? <Sun /> : <Moon />}</Button><a className="zenon-mark" href="https://zenon.network" target="_blank" rel="noreferrer" aria-label="Zenon Network"><img src={`${import.meta.env.BASE_URL}znn-logo.svg`} alt="" /></a></div></div></header>
    <main className="page-container"><section className="page-heading"><div><span className="ledger section-eyebrow"><NetworkGlyph name="az" size={15} />Network governance</span><h1>Accelerator-Z<span className="title-period">.</span></h1><p>Follow the proposals. Read the signals. Review the published position.</p></div><span className="snapshot-chip"><Clock3 size={14} />Vote snapshot: {dateTime(snapshot.fetchedAt)}</span></section>
      <section className="overview" aria-label="Tracking summary"><div className="overview-stat"><span className="ledger">Tracked proposals</span><div><span className="stat-value">{projects.length.toString().padStart(2, '0')}</span><span className="stat-detail"><span className="mini-dot" />{votingProjects.length} in voting</span></div></div><div className="overview-stat"><span className="ledger">Work packages</span><div><span className="stat-value">{packages.length.toString().padStart(2, '0')}</span><span className="stat-detail">{site.trackedOwners.length} tracked author{site.trackedOwners.length === 1 ? '' : 's'}</span></div></div><div className="overview-stat"><span className="ledger">Total requested</span><div className="request-stat"><Amount value={tokenAmount(projects, 'znnFundsNeeded')} decimals={0} symbol="ZNN" /><small><Amount value={tokenAmount(projects, 'qsrFundsNeeded')} decimals={0} symbol="QSR" /></small></div></div><div className="overview-stat quorum-stat"><span className="ledger">Participation quorum</span><div><span className="stat-value">{quorum}</span><span className="stat-detail">of {snapshot.activePillars} active Pillars<br />&gt;33% + yes majority</span></div></div></section>
      <section id="tracker" className="tracker-section"><div className="static-tracker-heading"><div><span className="ledger">Network record</span><h2>Tracked proposals</h2></div><span>Voting data as of {dateTime(snapshot.fetchedAt)}</span></div><div className="author-strip"><span className="ledger">Authors</span>{site.trackedOwners.map(owner => <span className="tracked-author" key={owner.address}><span>{owner.name}</span><Address address={owner.address} start={8} end={6} href={`https://zenonhub.io/explorer/account/${owner.address}`} /></span>)}</div><div className="packages-list">{packages.map(group => <WorkPackage group={group} key={group.id} />)}</div><details className="voting-guide"><summary><ShieldCheck size={15} />How to read these votes <ChevronRight size={14} /></summary><div><p>Approval needs participation from more than 33% of active Pillars, including abstentions, and strictly more yes votes than no votes. With {snapshot.activePillars} active Pillars, that means at least {quorum} total votes. “More yes” and “more no to block” assume only new votes of that type, with existing votes unchanged.</p><p>No votes do not immediately reject a proposal. A tie or no majority blocks approval. A project that does not pass during its 14-day voting period closes when the contract updates. Pillars can change their votes. Network status is recorded in the GitHub JSON snapshot.</p><a href="https://github.com/zenon-network/go-zenon/blob/master/vm/embedded/implementation/accelerator.go" target="_blank" rel="noreferrer">Read the voting contract <ArrowUpRight size={12} /></a></div></details></section>
      <Assessment /><LlmBriefs />
      <footer className="site-footer"><span className="footer-brand"><NetworkGlyph name="pillar" size={18} />Pillar / Stance</span><span>Built for the Network of Momentum.</span><a href="https://github.com/0x3639/Pillar-Stance" target="_blank" rel="noreferrer">View source <ArrowUpRight size={13} /></a></footer>
    </main>
  </>;
}
