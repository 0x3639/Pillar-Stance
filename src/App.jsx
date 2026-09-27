import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Check, CheckCircle2, ChevronRight, Clock3, FileText, Layers3, MessageSquare, Moon, Package, Plus, RefreshCw, Settings2, ShieldCheck, Sun, ThumbsDown, ThumbsUp, Trash2, Wallet, Wrench, X } from 'lucide-react';
import { Button } from './design-system/components/core/Button';
import { Address } from './design-system/components/blockchain/Address';
import { Amount } from './design-system/components/blockchain/Amount';
import { NetworkGlyph } from './design-system/components/blockchain/NetworkGlyph';
import { CACHE_TTL, DEFAULT_OWNERS, NODE_URL } from './config';
import { buildPackages, safeExternalUrl, sequenceOf, VOTING_PERIOD, voteMetrics, votingState, votingTarget } from './proposals';
import { loadTracking } from './rpc';
import { remainingCacheTime } from './cache';
import { readStored, writeStored } from './storage';
import snapshot from './data/snapshot.json';

const shortDate = timestamp => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(timestamp * 1000));
const fullDate = timestamp => new Date(timestamp * 1000).toLocaleString();
const dateTime = iso => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const tokenAmount = (projects, token) => Number(projects.reduce((sum, p) => sum + BigInt(p[token] || 0), 0n)) / 1e8;
const validAddress = value => /^z1[023456789acdefghjklmnpqrstuvwxyz]{38}$/.test(value);

function useLocalState(key, fallback, validate) {
  const [value, setValue] = useState(() => {
    const stored = readStored(key, fallback);
    return validate && !validate(stored) ? fallback : stored;
  });
  const [error, setError] = useState('');
  function save(next) {
    try { writeStored(key, next); setValue(next); setError(''); return true; }
    catch { setError('Your browser could not save this change. Check that site storage is enabled.'); return false; }
  }
  return [value, save, error];
}

function PackageIcon({ type }) {
  if (['bridge', 'pillar'].includes(type)) return <NetworkGlyph name={type} size={22} />;
  const Icon = { layers: Layers3, wallet: Wallet, utilities: Wrench, package: Package }[type] || Package;
  return <Icon size={20} aria-hidden="true" />;
}

function VerifyLoader() {
  const quote = "Don’t Trust. Verify";
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setTyped(quote); return; }
    let count = 0;
    const timer = setInterval(() => { count++; setTyped(quote.slice(0, count)); if (count >= quote.length) clearInterval(timer); }, 25);
    return () => clearInterval(timer);
  }, []);
  return <div className="verify-loader" role="status" aria-live="polite"><span className="ledger">Verifying node data</span><span aria-hidden="true" className="verify-quote">{typed}<span className={`thinking-dots ${typed === quote ? 'ready' : ''}`}><span>.</span><span>.</span><span>.</span><span>.</span></span></span><span className="sr-only">Don’t Trust. Verify. Loading proposal status from the public node.</span></div>;
}

function StatusBadge({ project }) {
  const state = votingState(project);
  const isOpen = ['Voting', 'Phase voting'].includes(state);
  const isClosed = ['Closed', 'Awaiting closure'].includes(state);
  const Icon = isOpen || isClosed ? Clock3 : CheckCircle2;
  return <span className={`status-badge ${isOpen ? 'voting' : isClosed ? 'closed' : 'approved'}`}><Icon size={13} aria-hidden="true" />{state}</span>;
}

function VoteSummary({ project, activePillars }) {
  const target = votingTarget(project);
  const metrics = voteMetrics(target.votes, activePillars);
  const state = votingState(project);
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
    {isOpen ? <div className="votes-needed"><span className="yes" title="Additional yes votes needed for participation above 33% and more yes than no, if existing votes stay unchanged."><strong>{metrics.yesNeeded}</strong> more yes to approve</span><span title="Additional no votes to reach quorum with no at least equal to yes. This blocks approval; it does not immediately close the project. Existing votes can change."><strong>{metrics.noNeeded}</strong> more no to block</span></div> : <div className="votes-needed settled">{state === 'Awaiting closure' ? 'Voting period ended · awaiting node update' : state === 'Closed' ? 'Closed on-chain' : 'Project approval complete'}{target.isPhase && ' · phase tally shown'}</div>}
  </div>;
}

function ProposalRow({ project, activePillars, onOpinion, opinion }) {
  const target = votingTarget(project);
  const discussion = safeExternalUrl(project.url);
  const deadline = project.creationTimestamp + VOTING_PERIOD;
  return <article className="proposal-row">
    <div className="proposal-info">
      <div className="proposal-title"><span className="sequence">{sequenceOf(project) ? String(sequenceOf(project)).padStart(2, '0') : <FileText size={15} />}</span><h3>{project.name}</h3><StatusBadge project={project} /></div>
      <p>{project.description}</p>
      <div className="proposal-metadata"><span className="funding"><Amount value={Number(project.znnFundsNeeded) / 1e8} decimals={0} symbol="ZNN" /><span className="separator">/</span><Amount value={Number(project.qsrFundsNeeded) / 1e8} decimals={0} symbol="QSR" /></span><span className="deadline" title={fullDate(deadline)}><Clock3 size={12} />{target.isPhase ? `Phase submitted ${shortDate(target.creationTimestamp)} UTC` : `Voting ends ${shortDate(deadline)} UTC`}</span></div>
    </div>
    <VoteSummary project={project} activePillars={activePillars} />
    <div className="proposal-actions"><a className="explorer-link" href={`https://zenonhub.io/accelerator-z/project/${project.id}`} target="_blank" rel="noreferrer">Zenon Hub <ArrowUpRight size={14} /></a>{discussion && <a className="discussion-link" href={discussion} target="_blank" rel="noreferrer">Discussion <ArrowUpRight size={12} /></a>}<button className={`stance-link ${opinion?.stance || ''}`} onClick={() => onOpinion(project.id)}>{opinion ? <>{opinion.stance === 'support' ? <ThumbsUp size={13} /> : <ThumbsDown size={13} />}{opinion.stance === 'support' ? 'You support' : 'You reject'}</> : <>Your stance <ArrowDown size={12} /></>}</button></div>
  </article>;
}

function WorkPackage({ group, activePillars, opinions, onOpinion }) {
  const voting = group.projects.filter(p => ['Voting', 'Phase voting'].includes(votingState(p))).length;
  return <section className="work-package" aria-labelledby={`package-${group.key}`}>
    <header className="package-header"><div className="package-heading"><span className="package-icon"><PackageIcon type={group.icon} /></span><div><div className="package-title"><h2 id={`package-${group.key}`}>{group.name}</h2><span className="package-count">{group.projects.length} AZ{group.projects.length > 1 ? 's' : ''}</span></div><p>{group.projects.length > 1 ? group.description : group.ownerName}</p></div></div><div className="package-total"><span className="ledger">Package request</span><Amount value={tokenAmount(group.projects, 'znnFundsNeeded')} decimals={0} symbol="ZNN" /></div><div className="package-state"><span className="small-status"><Clock3 size={13} />{voting ? `${voting} in voting` : 'Voting complete'}</span><span className="ledger">{shortDate(group.projects[0].creationTimestamp)} submission</span></div></header>
    {group.projects.map(project => <ProposalRow key={project.id} project={project} activePillars={activePillars} onOpinion={onOpinion} opinion={opinions[project.id]} />)}
  </section>;
}

function ManageDialog({ open, onClose, owners, saveOwners, projects, groups, saveGroups }) {
  const dialog = useRef(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { if (open) dialog.current.showModal(); else dialog.current.close(); }, [open]);
  const addAuthor = event => {
    event.preventDefault();
    const cleanAddress = address.trim();
    if (!validAddress(cleanAddress)) return setError('Enter a Zenon address beginning with z1 (40 characters).');
    if (owners.some(owner => owner.address === cleanAddress)) return setError('This address is already tracked.');
    if (saveOwners([...owners, { name: name.trim(), address: cleanAddress }])) { setName(''); setAddress(''); setError(''); }
  };
  const addGroup = event => {
    event.preventDefault();
    if (selected.length < 2) return setError('Select at least two proposals for a work package.');
    // Move selected proposals out of previous custom groups to keep membership unique.
    const remaining = groups.map(group => ({ ...group, projectIds: group.projectIds.filter(id => !selected.includes(id)) })).filter(group => group.projectIds.length);
    if (saveGroups([...remaining, { id: crypto.randomUUID(), name: groupName.trim(), projectIds: selected }])) { setGroupName(''); setSelected([]); setError(''); }
  };
  return <dialog ref={dialog} className="manage-dialog" onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <header className="dialog-header"><div><span className="ledger">Tracker settings</span><h2>Make it your watchlist.</h2></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close settings"><X /></Button></header>
    <p className="dialog-intro">Authors and custom packages are saved in this browser.</p>
    <section><h3>Tracked authors</h3><div className="author-list">{owners.map(owner => <div className="author" key={owner.address}><div><strong>{owner.name}</strong><Address address={owner.address} start={12} end={8} /></div><Button variant="ghost" size="icon" onClick={() => saveOwners(owners.filter(o => o.address !== owner.address))} aria-label={`Stop tracking ${owner.name}`}><Trash2 /></Button></div>)}</div><form onSubmit={addAuthor} className="author-form"><label>Author label<input required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Sol’s AZs" maxLength={60} /></label><label>Zenon address<input required value={address} onChange={event => setAddress(event.target.value)} placeholder="z1…" className="mono" maxLength={40} /></label><Button variant="outline" type="submit"><Plus />Track author</Button></form></section>
    <section><h3>Custom work packages</h3><p className="muted">Ferry and ZVM are grouped automatically. Create a package to group any other proposals.</p>{groups.map(group => <div className="custom-group" key={group.id}><span>{group.name}<small>{group.projectIds.length} proposals</small></span><Button variant="ghost" size="icon" onClick={() => saveGroups(groups.filter(g => g.id !== group.id))} aria-label={`Remove package ${group.name}`}><Trash2 /></Button></div>)}<form onSubmit={addGroup}><label>Package name<input required value={groupName} onChange={event => setGroupName(event.target.value)} placeholder="e.g. Developer tools" maxLength={60} /></label><div className="proposal-picker">{projects.map(project => <label key={project.id}><input type="checkbox" checked={selected.includes(project.id)} onChange={event => setSelected(event.target.checked ? [...selected, project.id] : selected.filter(id => id !== project.id))} /><span>{project.name}</span></label>)}{!projects.length && <p className="muted">Track an author to load proposals first.</p>}</div><Button variant="outline" type="submit" disabled={!projects.length}><Package />Create work package</Button></form></section>
    {error && <p className="form-error" role="alert">{error}</p>}<footer className="dialog-footer"><Button onClick={onClose}>Done</Button></footer>
  </dialog>;
}

function OpinionSection({ packages, opinions, saveOpinions, requestedProject, onSelectProject }) {
  const [selected, setSelected] = useState('');
  const [scope, setScope] = useState('all');
  const [stance, setStance] = useState('');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const group = packages.find(p => p.key === selected) || packages[0];
  const targetProjects = group ? scope === 'all' ? group.projects : group.projects.filter(p => p.id === scope) : [];
  const targetKey = targetProjects.map(p => p.id).join(',');
  useEffect(() => { if (group && scope !== 'all' && !group.projects.some(p => p.id === scope)) setScope('all'); }, [group, scope]);
  useEffect(() => {
    if (!requestedProject) return;
    const targetGroup = packages.find(p => p.projects.some(project => project.id === requestedProject));
    if (targetGroup) { setSelected(targetGroup.key); setScope(requestedProject); }
  }, [requestedProject, packages]);
  useEffect(() => {
    const records = targetProjects.map(project => opinions[project.id]);
    const common = records.length && records.every(record => record && record.stance === records[0]?.stance && record.note === records[0]?.note) ? records[0] : null;
    setStance(common?.stance || ''); setNote(common?.note || '');
  }, [targetKey, opinions]); // Reload the saved stance when the selected proposal changes.
  useEffect(() => { setFeedback(''); }, [targetKey]);
  function submit(event) {
    event.preventDefault();
    if (!stance) return setFeedback('Choose support or reject before saving.');
    const next = { ...opinions };
    const savedAt = new Date().toISOString();
    targetProjects.forEach(project => { next[project.id] = { proposalId: project.id, proposalName: project.name, owner: project.owner, stance, note: note.trim(), savedAt }; });
    if (saveOpinions(next)) setFeedback(`Saved for ${targetProjects.length === 1 ? targetProjects[0].name : `${targetProjects.length} proposals`}.`);
  }
  function exportOpinions() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), opinions: Object.values(opinions) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'pillar-stance-opinions.json'; anchor.click(); URL.revokeObjectURL(url);
  }
  return <section id="your-stance" className="opinion-section">
    <div className="section-heading"><div><span className="ledger section-eyebrow">Your perspective</span><h2>Where do you stand?</h2><p>Support or reject a proposal. Add the reasoning behind your decision.</p></div><span className="privacy-chip"><ShieldCheck size={15} />Saved in your browser</span></div>
    {group ? <div className="opinion-layout"><aside className="opinion-packages" aria-label="Choose a work package"><span className="ledger">Work packages</span>{packages.map(p => <button key={p.key} className={p.key === group.key ? 'selected' : ''} onClick={() => { setSelected(p.key); setScope('all'); onSelectProject(null); }}><span className="opinion-package-icon"><PackageIcon type={p.icon} /></span><span><strong>{p.name}</strong><small>{p.projects.length} proposal{p.projects.length > 1 ? 's' : ''}</small></span><ChevronRight size={15} /></button>)}</aside><div className="opinion-content"><form onSubmit={submit}><div className="opinion-form-heading"><h3>{group.name}</h3><span className="ledger">Personal stance</span></div><label className="scope-label">Apply to<select value={scope} onChange={event => { setScope(event.target.value); onSelectProject(null); }}><option value="all">{group.projects.length > 1 ? `Entire work package · ${group.projects.length} AZs` : group.projects[0].name}</option>{group.projects.length > 1 && group.projects.map(project => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><fieldset className="stance-options"><legend>Your opinion</legend>
        <label className={`stance-option support ${stance === 'support' ? 'chosen' : ''}`}>
          <input className="sr-only" type="radio" name="stance" value="support" checked={stance === 'support'} onChange={() => { setStance('support'); setFeedback(''); }} />
          <ThumbsUp size={21} /><span><strong>Support</strong><small>I’m in favor of this proposal</small></span><span className="radio-indicator">{stance === 'support' && <Check size={12} />}</span>
        </label>
        <label className={`stance-option reject ${stance === 'reject' ? 'chosen' : ''}`}>
          <input className="sr-only" type="radio" name="stance" value="reject" checked={stance === 'reject'} onChange={() => { setStance('reject'); setFeedback(''); }} />
          <ThumbsDown size={21} /><span><strong>Reject</strong><small>I don’t support this proposal</small></span><span className="radio-indicator">{stance === 'reject' && <Check size={12} />}</span>
        </label>
      </fieldset><label className="note-label">Your reasoning <span>Optional</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="What informed your decision? Scope, value, delivery, or anything else that matters to you." rows={4} maxLength={2000} /><small className="note-count mono">{note.length} / 2,000</small></label><div className="opinion-form-footer"><span>Personal opinions are separate from on-chain votes.</span><Button type="submit" disabled={!stance || !targetProjects.length}><Check size={16} />Save my stance</Button></div><p className="save-feedback" role="status">{feedback}</p></form>{group.projects.some(p => opinions[p.id]) && <div className="saved-stances"><span className="ledger">Your saved decisions</span>{group.projects.filter(p => opinions[p.id]).map(p => <div key={p.id} className="saved-stance"><span className={`saved-icon ${opinions[p.id].stance}`}>{opinions[p.id].stance === 'support' ? <ThumbsUp size={15} /> : <ThumbsDown size={15} />}</span><div><strong>{p.name}</strong><p>{opinions[p.id].note || (opinions[p.id].stance === 'support' ? 'Supported' : 'Rejected')}</p><small>Saved {dateTime(opinions[p.id].savedAt)}</small></div><Button variant="ghost" size="icon" aria-label={`Clear stance for ${p.name}`} onClick={() => { const next = { ...opinions }; delete next[p.id]; saveOpinions(next); }}><Trash2 /></Button></div>)}</div>}</div></div> : <div className="empty-state"><MessageSquare /><h3>No proposals selected</h3><p>Track an author to start recording your stance.</p></div>}
    <div className="opinion-bottom"><span><ShieldCheck size={14} />Only you can see these opinions on this device.</span><button disabled={!Object.keys(opinions).length} onClick={exportOpinions}>Export my decisions <ArrowUpRight size={13} /></button></div>
  </section>;
}

export default function App() {
  const [owners, saveOwners, ownersError] = useLocalState('owners', DEFAULT_OWNERS, value => Array.isArray(value) && value.every(o => typeof o.name === 'string' && validAddress(o.address)));
  const [customGroups, saveGroups, groupsError] = useLocalState('groups', [], value => Array.isArray(value) && value.every(g => typeof g.id === 'string' && typeof g.name === 'string' && Array.isArray(g.projectIds)));
  const [opinions, saveOpinions, opinionsError] = useLocalState('opinions', {}, value => value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(o => o && ['support', 'reject'].includes(o.stance) && typeof o.note === 'string' && !Number.isNaN(Date.parse(o.savedAt))));
  const [theme, saveTheme] = useLocalState('theme', 'dark', value => ['light', 'dark'].includes(value));
  const [data, setData] = useState(snapshot);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [requestedProject, setRequestedProject] = useState(null);
  const [filter, setFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(Date.now());
  const ownerKey = owners.map(owner => owner.address).sort().join(',');
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);
  useEffect(() => {
    let stopped = false;
    let controller;
    let nextRefresh;
    const cache = readStored(`snapshot:${ownerKey}`, null);
    const validCache = cache && Array.isArray(cache.projects) && cache.activePillars > 0 && !Number.isNaN(Date.parse(cache.fetchedAt));
    if (validCache) setData(cache);
    async function update() {
      controller?.abort();
      controller = new AbortController();
      const current = controller;
      const timeout = setTimeout(() => current.abort(new Error('The public node took too long to respond.')), 25_000);
      setStatus('connecting');
      try {
        const result = await loadTracking(owners, current.signal);
        if (!stopped && !current.signal.aborted) {
          setData(result); setStatus('live'); setError('');
          try { writeStored(`snapshot:${ownerKey}`, result); } catch { /* Live reads still work without browser storage. */ }
        }
      } catch (failure) {
        if (!stopped && current === controller) { setStatus('offline'); setError(failure.message || 'Could not connect to the public node.'); }
      } finally { clearTimeout(timeout); }
      if (!stopped) nextRefresh = setTimeout(update, CACHE_TTL);
    }
    const cacheTimeLeft = validCache ? remainingCacheTime(cache) : 0;
    if (refreshKey === 0 && cacheTimeLeft > 0) {
      setStatus('cached'); setError('');
      nextRefresh = setTimeout(update, cacheTimeLeft);
    } else update();
    return () => { stopped = true; controller?.abort(); clearTimeout(nextRefresh); };
  }, [ownerKey, refreshKey]);
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(interval); }, []);
  const projects = useMemo(() => data.projects.filter(p => owners.some(o => o.address === p.owner)), [data, owners]);
  const packages = useMemo(() => buildPackages(projects, owners, customGroups), [projects, owners, customGroups]);
  const votingProjects = projects.filter(p => ['Voting', 'Phase voting'].includes(votingState(p, now / 1000)));
  const shownPackages = packages.map(group => ({ ...group, projects: filter === 'voting' ? group.projects.filter(p => ['Voting', 'Phase voting'].includes(votingState(p, now / 1000))) : group.projects })).filter(group => group.projects.length);
  const quorum = Math.floor(data.activePillars * 33 / 100) + 1;
  function openOpinion(id) { setRequestedProject(id); document.getElementById('your-stance').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
  return <>
    <a href="#tracker" className="skip-link">Skip to proposals</a>
    <header className="site-header"><div className="header-inner"><a href="#" className="brand" aria-label="Pillar Stance home"><NetworkGlyph name="pillar" size={30} /><span>Pillar<span className="brand-divider">/</span><strong>Stance</strong></span></a><nav aria-label="Main navigation"><a href="#tracker" className="active">AZ tracker</a><a href="#your-stance">My stance</a></nav><div className="header-tools"><a href={NODE_URL} className={`node-status ${status}`} title={`Public RPC: ${NODE_URL}`} target="_blank" rel="noreferrer"><span className="status-dot" />{status === 'live' ? 'Node connected' : status === 'cached' ? 'Node data cached' : status === 'connecting' ? 'Verifying' : 'Node unavailable'}</a><Button variant="ghost" size="icon" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => saveTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />}</Button><a className="zenon-mark" href="https://zenon.network" target="_blank" rel="noreferrer" aria-label="Zenon Network"><img src={`${import.meta.env.BASE_URL}znn-logo.svg`} alt="" /></a></div></div></header>
    <main className="page-container"><section className="page-heading"><div><span className="ledger section-eyebrow"><NetworkGlyph name="az" size={15} />Network governance</span><h1>Accelerator-Z<span className="title-period">.</span></h1><p>Follow the proposals. Read the signals. Make your stance clear.</p></div><Button variant="outline" onClick={() => setManageOpen(true)}><Settings2 />Manage tracking</Button></section>
    <section className="overview" aria-label="Tracking summary"><div className="overview-stat"><span className="ledger">Tracked proposals</span><div><span className="stat-value">{projects.length.toString().padStart(2, '0')}</span><span className="stat-detail"><span className="mini-dot" />{votingProjects.length} in voting</span></div></div><div className="overview-stat"><span className="ledger">Work packages</span><div><span className="stat-value">{packages.length.toString().padStart(2, '0')}</span><span className="stat-detail">{owners.length} tracked author{owners.length !== 1 ? 's' : ''}</span></div></div><div className="overview-stat"><span className="ledger">Total requested</span><div className="request-stat"><Amount value={tokenAmount(projects, 'znnFundsNeeded')} decimals={0} symbol="ZNN" /><small><Amount value={tokenAmount(projects, 'qsrFundsNeeded')} decimals={0} symbol="QSR" /></small></div></div><div className="overview-stat quorum-stat"><span className="ledger">Participation quorum</span><div><span className="stat-value">{quorum}</span><span className="stat-detail">of {data.activePillars} active Pillars<br />&gt;33% + yes majority</span></div></div></section>
    {ownersError || groupsError || opinionsError ? <p className="error-banner" role="alert">{ownersError || groupsError || opinionsError}</p> : null}
    {status === 'offline' && <div className="error-banner" role="status"><Clock3 size={16} /><span>{error} Showing saved data from {dateTime(data.fetchedAt)}.</span><button onClick={() => setRefreshKey(key => key + 1)}>Retry</button></div>}
    <section id="tracker" className="tracker-section"><div className="tracker-heading"><div className="tracker-tabs" aria-label="Filter proposals"><button className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All proposals <span>{projects.length}</span></button><button className={filter === 'voting' ? 'active' : ''} aria-pressed={filter === 'voting'} onClick={() => setFilter('voting')}>In voting <span>{votingProjects.length}</span></button></div><div className="refresh-controls"><span title={new Date(data.fetchedAt).toLocaleString()}>{['live', 'cached'].includes(status) ? 'Updated' : 'Snapshot'} {new Date(data.fetchedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span><Button variant="ghost" size="icon" aria-label="Refresh proposal status" disabled={status === 'connecting'} onClick={() => setRefreshKey(key => key + 1)}><RefreshCw /></Button></div></div>
    {status === 'connecting' && <VerifyLoader />}
    <div className="author-strip"><span className="ledger">Tracking</span>{owners.map(owner => <span className="tracked-author" key={owner.address}><span>{owner.name}</span><Address address={owner.address} start={8} end={6} href={`https://zenonhub.io/explorer/account/${owner.address}`} /></span>)}{!owners.length && <span>No authors tracked</span>}<span className="auto-refresh">Cache TTL <b>5 min</b></span></div>
    <div className="packages-list">{shownPackages.map(group => <WorkPackage key={group.key} group={group} activePillars={data.activePillars} opinions={opinions} onOpinion={openOpinion} />)}</div>{!shownPackages.length && <div className="empty-state"><Package size={32} /><h3>{projects.length ? 'No proposals in voting' : status === 'connecting' ? 'Loading your proposals' : 'No proposals found'}</h3><p>{projects.length ? 'All tracked proposals have left the voting period.' : 'Add an author or check the tracked address to get started.'}</p><Button variant="outline" onClick={() => setManageOpen(true)}>Manage tracking</Button></div>}
    <details className="voting-guide"><summary><ShieldCheck size={15} />How to read these votes <ChevronRight size={14} /></summary><div><p>Approval needs participation from more than 33% of active Pillars, including abstentions, and strictly more yes votes than no votes. With {data.activePillars} active Pillars, that means at least {quorum} total votes. “More yes” assumes only new yes votes; “more no to block” assumes only new no votes, with existing votes unchanged.</p><p>No votes do not immediately reject a proposal. A tie or no majority blocks approval. A project that does not pass during its 14-day voting period closes when the contract updates. Pillars can change their votes. Project and phase status comes from the node; an approved project with a phase in voting shows that phase’s tally.</p><a href="https://github.com/zenon-network/go-zenon/blob/master/vm/embedded/implementation/accelerator.go" target="_blank" rel="noreferrer">Read the voting contract <ArrowUpRight size={12} /></a></div></details></section>
    <OpinionSection packages={packages} opinions={opinions} saveOpinions={saveOpinions} requestedProject={requestedProject} onSelectProject={setRequestedProject} />
    <footer className="site-footer"><span className="footer-brand"><NetworkGlyph name="pillar" size={18} />Pillar / Stance</span><span>Built for the Network of Momentum.</span><a href="https://github.com/0x3639/Pillar-Stance" target="_blank" rel="noreferrer">View source <ArrowUpRight size={13} /></a></footer>
    </main><ManageDialog open={manageOpen} onClose={() => setManageOpen(false)} owners={owners} saveOwners={saveOwners} projects={packages.flatMap(group => group.projects)} groups={customGroups} saveGroups={saveGroups} />
  </>;
}
