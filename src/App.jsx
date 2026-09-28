import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, CheckCircle2, ChevronRight, Clock3, Copy, ExternalLink, FileText, Layers3, Moon, Package, RefreshCw, ShieldCheck, Sun, Wallet, Wrench, X } from 'lucide-react';
import { Button } from './design-system/components/core/Button';
import { Address } from './design-system/components/blockchain/Address';
import { Amount } from './design-system/components/blockchain/Amount';
import { NetworkGlyph } from './design-system/components/blockchain/NetworkGlyph';
import { NODE_URL } from './config';
import { loadLiveVotes } from './live';
import { configuredPackages, packageVotes } from './published';
import { safeExternalUrl, sequenceOf, VOTING_PERIOD, voteCountdown, voteMetrics, votingState, votingTarget } from './proposals';
import site from './data/site.json';

const shortDate = timestamp => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(timestamp * 1000));
const dateTime = iso => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const tokenAmount = (entries, token) => Number(entries.reduce((sum, project) => sum + BigInt(project[token] || 0), 0n)) / 1e8;
const briefUrl = `${import.meta.env.BASE_URL}evaluate-the-work.txt`;

function PackageIcon({ type }) {
  if (['bridge', 'pillar'].includes(type)) return <NetworkGlyph name={type} size={22} />;
  const Icon = { layers: Layers3, wallet: Wallet, utilities: Wrench, package: Package }[type] || Package;
  return <Icon size={20} aria-hidden="true" />;
}

function StatusBadge({ project, now }) {
  const state = votingState(project, now / 1000);
  const isOpen = ['Voting', 'Phase voting'].includes(state);
  const isClosed = ['Closed', 'Awaiting closure'].includes(state);
  const Icon = isOpen || isClosed ? Clock3 : CheckCircle2;
  return <span className={`status-badge ${isOpen ? 'voting' : isClosed ? 'closed' : 'approved'}`}><Icon size={13} aria-hidden="true" />{state}</span>;
}

function VoteSummary({ project, tracking, now }) {
  const target = votingTarget(project);
  const metrics = voteMetrics(target.votes, tracking.activePillars);
  const state = votingState(project, now / 1000);
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

function ProposalRow({ project, tracking, now }) {
  const target = votingTarget(project);
  const discussion = safeExternalUrl(project.url);
  const deadline = project.creationTimestamp + VOTING_PERIOD;
  const countdown = voteCountdown(project, now / 1000);
  return <article className="proposal-row">
    <div className="proposal-info">
      <div className="proposal-title"><span className="sequence">{sequenceOf(project) ? String(sequenceOf(project)).padStart(2, '0') : <FileText size={15} />}</span><h3>{project.name}</h3><StatusBadge project={project} now={now} /></div>
      <p>{project.description}</p>
      <div className="proposal-metadata"><span className="funding"><Amount value={Number(project.znnFundsNeeded) / 1e8} decimals={0} symbol="ZNN" /><span className="separator">/</span><Amount value={Number(project.qsrFundsNeeded) / 1e8} decimals={0} symbol="QSR" /></span><span className="deadline" title={new Date((target.isPhase ? target.creationTimestamp : deadline) * 1000).toISOString()}><Clock3 size={12} />{target.isPhase ? `Phase submitted ${shortDate(target.creationTimestamp)} UTC` : `Voting ends ${shortDate(deadline)} UTC`}</span>{countdown && <time className="vote-countdown" dateTime={new Date(deadline * 1000).toISOString()}>{countdown}</time>}</div>
    </div>
    <VoteSummary project={project} tracking={tracking} now={now} />
    <div className="proposal-actions"><a className="explorer-link" href={`https://zenonhub.io/accelerator-z/project/${project.id}`} target="_blank" rel="noreferrer">Zenon Hub <ArrowUpRight size={14} /></a>{discussion && <a className="discussion-link" href={discussion} target="_blank" rel="noreferrer">Discussion <ArrowUpRight size={12} /></a>}</div>
  </article>;
}

function Ballot({ vote }) {
  if (vote === undefined) return <span className="ballot uncast">—</span>;
  const label = ['Yes', 'No', 'Abstain'][vote] || 'Unknown';
  return <span className={`ballot ${label.toLowerCase()}`}>{label}</span>;
}

function PillarVotes({ group, tracking }) {
  const { pillars, totals, unlisted } = packageVotes(group, tracking);
  return <details className="pillar-votes">
    <summary><span className="pillar-vote-heading"><ShieldCheck size={16} /><strong>Pillar voting</strong><span>{pillars.length} named Pillar{pillars.length === 1 ? '' : 's'} · {totals.yes} yes / {totals.no} no / {totals.abstain} abstain ballots</span></span><ChevronRight size={16} className="details-chevron" /></summary>
    <div className="pillar-vote-body"><p>Latest recorded ballot for each AZ as of {dateTime(tracking.fetchedAt)}. A Pillar can change its vote.</p>
      {pillars.length ? <><p className="ballot-scroll-hint">Swipe sideways to see every AZ ballot.</p><div className="ballot-table-scroll"><table className="ballot-table"><thead><tr><th scope="col">Pillar</th>{group.projects.map(project => <th scope="col" key={project.id}>{project.name}</th>)}</tr></thead><tbody>{pillars.map(pillar => <tr key={pillar.name}><th scope="row">{pillar.name}</th>{group.projects.map(project => <td key={project.id}><Ballot vote={pillar.votes[project.id]} /></td>)}</tr>)}</tbody></table></div></> : <p className="empty-voters">No named Pillar votes in this node read.</p>}
      {unlisted > 0 && <p className="unlisted-note">{unlisted} ballot{unlisted === 1 ? '' : 's'} in the node totals could not be matched to the current active Pillar list.</p>}
    </div>
  </details>;
}

function WorkPackage({ group, tracking, now }) {
  const voting = group.projects.filter(project => ['Voting', 'Phase voting'].includes(votingState(project, now / 1000))).length;
  return <section className="work-package" aria-labelledby={`package-${group.id}`}>
    <header className="package-header"><div className="package-heading"><span className="package-icon"><PackageIcon type={group.icon} /></span><div><div className="package-title"><h2 id={`package-${group.id}`}>{group.name}</h2><span className="package-count">{group.projects.length} AZ{group.projects.length > 1 ? 's' : ''}</span></div><p>{group.description}</p></div></div><div className="package-total"><span className="ledger">Package request</span><Amount value={tokenAmount(group.projects, 'znnFundsNeeded')} decimals={0} symbol="ZNN" /></div><div className="package-state"><span className="small-status"><Clock3 size={13} />{voting ? `${voting} in voting` : 'Voting complete'}</span><span className="ledger">{shortDate(group.projects[0].creationTimestamp)} submission</span></div></header>
    {group.projects.map(project => <ProposalRow key={project.id} project={project} tracking={tracking} now={now} />)}
    <PillarVotes group={group} tracking={tracking} />
  </section>;
}

function Assessment() {
  return <section id="assessment" className="assessment-section"><div className="section-heading"><div><span className="ledger section-eyebrow">{site.assessment.status} position</span><h2>My assessment</h2></div></div>
    <article className="assessment-prose"><h3>{site.assessment.title}</h3>{site.assessment.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article>
  </section>;
}

function LlmBriefs() {
  const [copied, setCopied] = useState(false);
  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(new URL(briefUrl, window.location.origin).href);
      setCopied(true);
    } catch { setCopied(false); }
  }
  return <section id="ai-briefs" className="brief-section"><div className="section-heading"><div><span className="ledger section-eyebrow">Independent review</span><h2>Evaluate the Work</h2><p>One link gives an LLM the full set of AZ filings, forum discussions, repositories, my draft assessment, and a method for checking current votes. Share it with Claude or another LLM, then ask your own questions about the work.</p></div></div><div className="brief-list"><article className="brief-card brief-feature"><span className="package-icon"><FileText size={20} aria-hidden="true" /></span><div><h3>Complete Pillar evaluation context</h3><p>All nine AZs · source links and review questions · no saved vote results</p></div><div className="brief-actions"><button type="button" onClick={copyBrief}><Copy size={15} />{copied ? 'Copied' : 'Copy link'}</button><a href={briefUrl} target="_blank" rel="noreferrer">Open text file <ExternalLink size={15} /></a></div></article></div><div className="work-links"><span className="ledger">Work available so far</span><div>{site.workLinks.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.name}<ArrowUpRight size={13} /></a>)}</div></div><p className="brief-footnote">The text file contains stable context only. It directs the LLM to inspect current forum replies, code, demos, and on-chain votes before drawing conclusions.</p></section>;
}

function LoadingQuote() {
  const quote = "Don't Trust. Verify";
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTyped(value => Math.min(quote.length, value + 1)), 25);
    return () => clearInterval(interval);
  }, []);
  return <div className="verify-loader" role="status" aria-label="Don't Trust. Verify. Loading votes from the public node.">
    <span className="ledger">Checking public node</span>
    <span className="verify-quote" aria-hidden="true">{quote.slice(0, typed)}<span className={`thinking-dots ${typed === quote.length ? 'ready' : ''}`}><span>.</span><span>.</span><span>.</span><span>.</span></span></span>
  </div>;
}

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [now, setNow] = useState(() => Date.now());
  const [tracking, setTracking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const refreshRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    let controller = null;
    async function refresh() {
      if (controller) return;
      controller = new AbortController();
      const current = controller;
      const timeout = setTimeout(() => current.abort(), 60_000);
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await loadLiveVotes(site, current.signal);
        if (active) setTracking(result);
      } catch (error) {
        if (active) setLoadError(current.signal.aborted ? 'The public node timed out. Please try again.' : error.message);
      } finally {
        clearTimeout(timeout);
        if (active) setIsLoading(false);
        if (controller === current) controller = null;
      }
    }
    refreshRef.current = refresh;
    refresh();
    const interval = setInterval(refresh, 5 * 60_000);
    return () => {
      active = false;
      clearInterval(interval);
      controller?.abort();
      refreshRef.current = null;
    };
  }, []);

  const packages = tracking ? configuredPackages(site, tracking) : [];
  const projects = packages.flatMap(group => group.projects);
  const votingProjects = tracking ? projects.filter(project => ['Voting', 'Phase voting'].includes(votingState(project, now / 1000))) : [];
  const quorum = tracking ? Math.floor(tracking.activePillars * 33 / 100) + 1 : 0;
  const nodeState = loadError ? 'offline' : tracking ? 'live' : '';
  const nodeLabel = loadError ? 'Node unavailable' : isLoading ? 'Checking public node' : 'Public node';

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    setTheme(next);
  }

  return <>
    <a href="#tracker" className="skip-link">Skip to proposals</a>
    <header className="site-header"><div className="header-inner">
      <a href="#" className="brand" aria-label="Pillar Stance home"><NetworkGlyph name="pillar" size={30} /><span>Pillar<span className="brand-divider">/</span><strong>Stance</strong></span></a>
      <nav aria-label="Main navigation"><a href="#tracker" className="active">AZ tracker</a><a href="#ai-briefs">Evaluate the Work</a><a href="#assessment">My assessment</a></nav>
      <div className="header-tools"><span className={`node-status ${nodeState}`} title={`Vote source: ${NODE_URL}`}><span className="status-dot" />{nodeLabel}</span><Button variant="ghost" size="icon" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>{theme === 'dark' ? <Sun /> : <Moon />}</Button><a className="zenon-mark" href="https://zenon.network" target="_blank" rel="noreferrer" aria-label="Zenon Network"><img src={`${import.meta.env.BASE_URL}znn-logo.svg`} alt="" /></a></div>
    </div></header>
    <main className="page-container">
      <section className="page-heading"><div><span className="ledger section-eyebrow"><NetworkGlyph name="az" size={15} />Network governance</span><h1>Accelerator-Z<span className="title-period">.</span></h1><p>Follow the proposals. Read the signals. Review the published position.</p></div><div className="live-controls"><span className="snapshot-chip"><Clock3 size={14} />{tracking ? `Node read: ${dateTime(tracking.fetchedAt)}` : 'Waiting for node votes'}</span><Button variant="outline" size="sm" type="button" disabled={isLoading} onClick={() => refreshRef.current?.()}><RefreshCw size={14} className={isLoading ? 'refreshing' : ''} />Refresh votes</Button></div></section>
      {isLoading && <LoadingQuote />}
      {loadError && <div className="error-banner" role="alert"><span>{loadError}{tracking ? ` Showing the last public-node read from ${dateTime(tracking.fetchedAt)}.` : ''}</span><button type="button" onClick={() => refreshRef.current?.()}>Try again</button></div>}
      {tracking && <section className="overview" aria-label="Tracking summary"><div className="overview-stat"><span className="ledger">Tracked proposals</span><div><span className="stat-value">{projects.length.toString().padStart(2, '0')}</span><span className="stat-detail"><span className="mini-dot" />{votingProjects.length} in voting</span></div></div><div className="overview-stat"><span className="ledger">Work packages</span><div><span className="stat-value">{packages.length.toString().padStart(2, '0')}</span><span className="stat-detail">{site.trackedOwners.length} tracked author{site.trackedOwners.length === 1 ? '' : 's'}</span></div></div><div className="overview-stat"><span className="ledger">Total requested</span><div className="request-stat"><Amount value={tokenAmount(projects, 'znnFundsNeeded')} decimals={0} symbol="ZNN" /><Amount value={tokenAmount(projects, 'qsrFundsNeeded')} decimals={0} symbol="QSR" /></div></div><div className="overview-stat quorum-stat"><span className="ledger">Participation quorum</span><div><span className="stat-value">{quorum}</span><span className="stat-detail">of {tracking.activePillars} active Pillars<br />&gt;33% + yes majority</span></div></div></section>}
      <section id="tracker" className="tracker-section"><div className="static-tracker-heading"><div><span className="ledger">Network record</span><h2>Tracked proposals</h2></div><span>{tracking ? `Public node read ${dateTime(tracking.fetchedAt)} · refreshes every 5 minutes` : `Vote source: ${NODE_URL}`}</span></div><div className="author-strip"><span className="ledger">Authors</span>{site.trackedOwners.map(owner => <span className="tracked-author" key={owner.address}><span>{owner.name}</span><Address address={owner.address} start={8} end={6} href={`https://zenonhub.io/explorer/account/${owner.address}`} /></span>)}</div>
        {tracking ? <><div className="packages-list">{packages.map(group => <WorkPackage group={group} tracking={tracking} now={now} key={group.id} />)}</div><details className="voting-guide"><summary><ShieldCheck size={15} />How to read these votes <ChevronRight size={14} /></summary><div><p>Approval needs participation from more than 33% of active Pillars, including abstentions, and strictly more yes votes than no votes. With {tracking.activePillars} active Pillars, that means at least {quorum} total votes. “More yes” and “more no to block” assume only new votes of that type, with existing votes unchanged.</p><p>No votes do not immediately reject a proposal. A tie or no majority blocks approval. A project that does not pass during its 14-day voting period closes when the contract updates. Phase ballots have no fixed deadline in the contract. Pillars can change their votes. Counts and named ballots are read from the public node; use Refresh votes for a new read.</p><a href="https://github.com/zenon-network/go-zenon/blob/master/vm/embedded/implementation/accelerator.go" target="_blank" rel="noreferrer">Read the voting contract <ArrowUpRight size={12} /></a></div></details></> : <div className="empty-state"><h3>Waiting for public-node votes</h3><p>Proposal status and Pillar ballots appear after the node responds.</p></div>}
      </section>
      <LlmBriefs />
      <Assessment />
      <footer className="site-footer"><span className="footer-brand"><NetworkGlyph name="pillar" size={18} />Pillar / Stance</span><span>Built for the Network of Momentum.</span><a href="https://github.com/0x3639/Pillar-Stance" target="_blank" rel="noreferrer">View source <ArrowUpRight size={13} /></a></footer>
    </main>
  </>;
}
