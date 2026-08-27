'use client';

import Image from 'next/image';
import { useState } from 'react';

type View = 'Dashboard' | 'Domains' | 'Projects' | 'Agent Activity';
type Developer = 'Barry' | 'Clive';
type DomainStatus = 'Available' | 'Template Loaded' | 'Busy Working' | 'Final Stages';

type Domain = {
  id: number;
  domain: string;
  client: string;
  status: DomainStatus;
  developer?: Developer;
  stage?: string;
  progress: number;
  wordpress: string;
  host: string;
  template: string;
};

type Project = {
  id: number;
  client: string;
  buildType: 'Template' | 'Custom';
  developer: Developer;
  domain: string;
  stage: string;
  progress: number;
  due: string;
  next: string;
};

const navItems: { label: View; icon: string }[] = [
  { label: 'Dashboard', icon: '⌂' },
  { label: 'Domains', icon: '◇' },
  { label: 'Projects', icon: '▤' },
  { label: 'Agent Activity', icon: '◉' },
];

const viewCopy: Record<View, { eyebrow: string; title: string; subtitle: string }> = {
  Dashboard: {
    eyebrow: 'Website production',
    title: 'Good morning',
    subtitle: 'See what is available, active, and ready for review.',
  },
  Domains: {
    eyebrow: 'Domain management',
    title: 'Development domains',
    subtitle: 'Connected WordPress spaces, templates, and current availability.',
  },
  Projects: {
    eyebrow: 'Build pipeline',
    title: 'Client projects',
    subtitle: 'Every active build, its owner, current stage, and next action.',
  },
  'Agent Activity': {
    eyebrow: 'Codex reporting',
    title: 'Barry & Clive activity',
    subtitle: 'A simple view of agent availability and reported build progress.',
  },
};

const columns: DomainStatus[] = ['Available', 'Template Loaded', 'Busy Working', 'Final Stages'];
const buildStages = [
  'Setup',
  'Build Home Page',
  'Review Home Page',
  'Set Up Service Page Template',
  'Build First Service Page',
  'Build All Service Pages',
  'Build Service Page Hub',
  'Location Pages (optional)',
  'Review Full Build',
  'Launch Preparation',
  'Migrated to Live Site',
  'Ready to Delete',
];

const domains: Domain[] = [
  { id: 1, domain: 'dev-01.spyderweb.co.za', client: 'Ready for a new project', status: 'Available', progress: 0, wordpress: '6.8.2', host: 'HostAfrica', template: 'None' },
  { id: 2, domain: 'dev-02.spyderweb.co.za', client: 'Ready for a new project', status: 'Available', progress: 0, wordpress: '6.8.2', host: 'HostAfrica', template: 'None' },
  { id: 3, domain: 'dev-03.spyderweb.co.za', client: 'Approved template ready', status: 'Template Loaded', progress: 15, wordpress: '6.8.2', host: 'HostAfrica', template: 'Barry Core v4' },
  { id: 4, domain: 'northstar-dev.co.za', client: 'Northstar Exterior', status: 'Busy Working', developer: 'Barry', stage: 'Build All Service Pages', progress: 62, wordpress: '6.8.2', host: 'HostAfrica', template: 'Barry Core v4' },
  { id: 5, domain: 'clearwater-dev.co.za', client: 'Clearwater Plumbing', status: 'Busy Working', developer: 'Clive', stage: 'Review Home Page', progress: 38, wordpress: '6.8.2', host: 'HostAfrica', template: 'Custom' },
  { id: 6, domain: 'oakandstone-dev.co.za', client: 'Oak & Stone', status: 'Final Stages', developer: 'Barry', stage: 'Launch Preparation', progress: 91, wordpress: '6.8.2', host: 'HostAfrica', template: 'Barry Core v4' },
];

const projects: Project[] = [
  { id: 1, client: 'Northstar Exterior', buildType: 'Template', developer: 'Barry', domain: 'northstar-dev.co.za', stage: 'Build All Service Pages', progress: 62, due: '2 Sep', next: 'Complete remaining service pages' },
  { id: 2, client: 'Clearwater Plumbing', buildType: 'Custom', developer: 'Clive', domain: 'clearwater-dev.co.za', stage: 'Review Home Page', progress: 38, due: '30 Aug', next: 'Customer home-page feedback' },
  { id: 3, client: 'Oak & Stone', buildType: 'Template', developer: 'Barry', domain: 'oakandstone-dev.co.za', stage: 'Launch Preparation', progress: 91, due: '28 Aug', next: 'Final launch approval' },
  { id: 4, client: 'Horizon Solar', buildType: 'Template', developer: 'Barry', domain: 'dev-04.spyderweb.co.za', stage: 'Set Up Service Page Template', progress: 47, due: '5 Sep', next: 'Build first service page' },
  { id: 5, client: 'Warren Attorneys', buildType: 'Custom', developer: 'Clive', domain: 'legal-dev.spyderweb.co.za', stage: 'Setup', progress: 18, due: '12 Sep', next: 'Confirm custom design direction' },
  { id: 6, client: 'Tranquil Health', buildType: 'Template', developer: 'Barry', domain: 'health-dev.spyderweb.co.za', stage: 'Review Full Build', progress: 82, due: '31 Aug', next: 'Internal full-site review' },
];

const activities = [
  { time: '12:42', agent: 'Barry', project: 'Northstar Exterior', action: 'Reported all core service pages complete.', status: 'Completed' },
  { time: '12:18', agent: 'Clive', project: 'Clearwater Plumbing', action: 'Submitted the custom home page for review.', status: 'Review' },
  { time: '11:52', agent: 'System', project: 'Warren Attorneys', action: 'Pre-flight check completed with no blockers.', status: 'Ready' },
  { time: '11:20', agent: 'Barry', project: 'Horizon Solar', action: 'Imported the approved template and verified pages.', status: 'Completed' },
  { time: '10:36', agent: 'Clive', project: 'Warren Attorneys', action: 'Created the new client project folder.', status: 'Started' },
  { time: '09:55', agent: 'Barry', project: 'Oak & Stone', action: 'Moved the build into launch preparation.', status: 'Updated' },
];

export default function Home() {
  const [activeView, setActiveView] = useState<View>('Dashboard');
  const [launchOpen, setLaunchOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [developer, setDeveloper] = useState<Developer>('Barry');
  const [launchStep, setLaunchStep] = useState(1);
  const [notice, setNotice] = useState('');
  const [activityFilter, setActivityFilter] = useState<'All' | Developer>('All');

  const copy = viewCopy[activeView];
  const selectedStageIndex = selectedProject
    ? Math.max(buildStages.indexOf(selectedProject.stage), 0)
    : 0;

  function changeView(view: View) {
    setActiveView(view);
    setSelectedDomain(null);
    setSelectedProject(null);
    setNotice('');
  }

  function openLaunch() {
    setSelectedDomain(null);
    setSelectedProject(null);
    setLaunchStep(1);
    setNotice('');
    setLaunchOpen(true);
  }

  function continueLaunch() {
    if (launchStep < 3) {
      setLaunchStep((step) => step + 1);
      return;
    }
    setNotice(`Demo build prepared for ${developer}. No live domain was changed.`);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Image src="/spyderweb-logo.png" alt="" width={38} height={38} priority /></span>
          <span><strong>SpyderWeb</strong><small>Control Center</small></span>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button className={`nav-item ${activeView === item.label ? 'active' : ''}`} key={item.label} onClick={() => changeView(item.label)}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-status"><span className="pulse" /><div><strong>Codex link ready</strong><small>Demo reporting connection</small></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="subheading">{copy.subtitle}</p></div>
          <div className="topbar-actions">
            <div className="user-chip"><span>BC</span><div><strong>Barry Codex</strong><small>Administrator</small></div></div>
            <button className="primary-button" onClick={openLaunch}><span>＋</span> Launch Build</button>
          </div>
        </header>

        {activeView === 'Dashboard' && <Dashboard onDomain={setSelectedDomain} onLaunch={openLaunch} />}
        {activeView === 'Domains' && <DomainsView onDomain={setSelectedDomain} onNotice={setNotice} notice={notice} />}
        {activeView === 'Projects' && <ProjectsView onProject={setSelectedProject} />}
        {activeView === 'Agent Activity' && <AgentActivity filter={activityFilter} onFilter={setActivityFilter} />}
      </section>

      {selectedDomain && !launchOpen && (
        <div className="drawer-backdrop" onClick={() => setSelectedDomain(null)}>
          <aside className="detail-drawer" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedDomain(null)}>×</button>
            <span className="drawer-logo"><Image src="/spyderweb-logo.png" alt="" width={61} height={61} /></span>
            <p className="eyebrow">Domain details</p><h2>{selectedDomain.domain}</h2><p className="drawer-copy">{selectedDomain.client}</p>
            <div className="detail-list">
              <div><span>Status</span><strong>{selectedDomain.status}</strong></div>
              <div><span>Developer</span><strong>{selectedDomain.developer ?? 'Not allocated'}</strong></div>
              <div><span>WordPress</span><strong>{selectedDomain.wordpress}</strong></div>
              <div><span>Template</span><strong>{selectedDomain.template}</strong></div>
              <div><span>Current stage</span><strong>{selectedDomain.stage ?? 'Ready to begin'}</strong></div>
            </div>
            <h3>Safe domain actions</h3>
            <button className="secondary-button" onClick={() => setNotice('Demo only: WordPress installation check prepared.')}>Fresh WordPress installation</button>
            <button className="secondary-button" onClick={() => setNotice('Demo only: approved template import prepared.')}>Load approved template</button>
            {notice && <p className="notice">{notice}</p>}
            <small className="simulation-note">Demo only — no live server actions are connected.</small>
          </aside>
        </div>
      )}

      {selectedProject && !launchOpen && (
        <div className="project-modal-backdrop" onClick={() => setSelectedProject(null)}>
          <section className="project-control-modal" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedProject(null)}>×</button>
            <header className="project-modal-header">
              <span className={`project-avatar ${selectedProject.developer.toLowerCase()}`}>{selectedProject.client.slice(0, 1)}</span>
              <div>
                <p className="eyebrow">Project control</p>
                <h2>{selectedProject.client}</h2>
                <p>{selectedProject.buildType} website managed by {selectedProject.developer}</p>
              </div>
              <span className={`developer modal-owner ${selectedProject.developer.toLowerCase()}`}>{selectedProject.developer}</span>
            </header>

            <div className="project-modal-body">
              <div className="project-control-main">
                <section className="project-progress-card">
                  <div><p>Overall build progress</p><strong>{selectedProject.progress}%</strong></div>
                  <div className="progress-track large"><span style={{ width: `${selectedProject.progress}%` }} /></div>
                  <div className="progress-card-meta"><span>Current stage: <b>{selectedProject.stage}</b></span><span>Target: <b>{selectedProject.due}</b></span></div>
                </section>

                <section className="build-stage-panel">
                  <div className="modal-section-heading"><div><p className="eyebrow">Build stages</p><h3>Project pipeline</h3></div><span>{selectedStageIndex + 1} of {buildStages.length}</span></div>
                  <div className="build-stage-list">
                    {buildStages.map((stage, index) => {
                      const state = index < selectedStageIndex ? 'complete' : index === selectedStageIndex ? 'current' : 'upcoming';
                      return (
                        <div className={`build-stage-item ${state}`} key={stage}>
                          <span>{state === 'complete' ? '✓' : index + 1}</span>
                          <div><strong>{stage}</strong><small>{state === 'complete' ? 'Completed' : state === 'current' ? 'Currently in progress' : 'Waiting'}</small></div>
                          {state === 'current' && <b>Current</b>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <aside className="project-control-sidebar">
                <section>
                  <p className="eyebrow">Project details</p>
                  <div className="modal-detail-list">
                    <div><span>Development domain</span><strong>{selectedProject.domain}</strong></div>
                    <div><span>Build type</span><strong>{selectedProject.buildType}</strong></div>
                    <div><span>Developer</span><strong>{selectedProject.developer}</strong></div>
                    <div><span>Target date</span><strong>{selectedProject.due}</strong></div>
                  </div>
                </section>
                <section className="next-action-card"><span>Next required action</span><strong>{selectedProject.next}</strong><p>This is the next item SpyderWeb would send to Codex or place into review.</p></section>
                <section className="project-actions">
                  <p className="eyebrow">Project controls</p>
                  <button className="primary-button wide" onClick={() => setNotice(`Demo instruction prepared for ${selectedProject.developer} in Codex.`)}>Send instruction to Codex</button>
                  <button className="secondary-button" onClick={() => setNotice('Demo only: current stage marked ready for completion.')}>Complete current stage</button>
                  <button className="secondary-button" onClick={() => setNotice('Demo only: project review request prepared.')}>Request project review</button>
                </section>
                {notice && <p className="notice">{notice}</p>}
                <small className="simulation-note">Demo controls only — no live project or agent data is changed.</small>
              </aside>
            </div>
          </section>
        </div>
      )}

      {launchOpen && (
        <div className="modal-backdrop" onClick={() => setLaunchOpen(false)}>
          <section className="launch-modal" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setLaunchOpen(false)}>×</button>
            <p className="eyebrow">Launch a website build</p><h2>Three simple steps</h2>
            <div className="stepper">{[1, 2, 3].map((step) => <span className={launchStep >= step ? 'active' : ''} key={step}>{step}</span>)}</div>
            {launchStep === 1 && <div className="launch-panel"><h3>Who should build it?</h3><p>Barry handles approved templates. Clive handles custom websites.</p><div className="developer-options">{(['Barry', 'Clive'] as const).map((name) => <button className={developer === name ? 'selected' : ''} key={name} onClick={() => setDeveloper(name)}><span className={`avatar ${name.toLowerCase()}`}>{name[0]}</span><strong>{name}</strong><small>{name === 'Barry' ? 'Template builds' : 'Custom builds'}</small></button>)}</div></div>}
            {launchStep === 2 && <div className="launch-panel"><h3>Select a development domain</h3><p>Choose one of the available, connected WordPress spaces.</p><div className="domain-options">{domains.filter((domain) => domain.status === 'Available').map((domain) => <button className={selectedDomain?.id === domain.id ? 'selected' : ''} key={domain.id} onClick={() => setSelectedDomain(domain)}><span>◎</span><strong>{domain.domain}</strong><small>Available</small></button>)}</div></div>}
            {launchStep === 3 && <div className="launch-panel"><h3>Client intake & assets</h3><p>Add the essentials now. The detailed form can follow inside the project.</p><label>Client or business name<input placeholder="e.g. Acme Plumbing" /></label><label>Project notes<textarea placeholder="What does the client need?" rows={3} /></label><button className="upload-box"><span>↑</span><strong>Upload client assets</strong><small>Logos, photos and documents</small></button></div>}
            {notice && <p className="notice success">{notice}</p>}
            <div className="modal-footer"><button className="text-button" onClick={() => launchStep > 1 ? setLaunchStep((step) => step - 1) : setLaunchOpen(false)}>{launchStep > 1 ? 'Back' : 'Cancel'}</button><button className="primary-button" onClick={continueLaunch}>{launchStep < 3 ? 'Continue' : 'Prepare Build'}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

function Dashboard({ onDomain, onLaunch }: { onDomain: (domain: Domain) => void; onLaunch: () => void }) {
  return (
    <>
      <section className="summary-row" aria-label="Platform summary">
        <div className="summary-card featured"><div><span className="summary-icon">⌁</span><p>Development domains</p><strong>{domains.length}</strong></div><span className="trend">All connected</span></div>
        <div className="summary-card"><div><span className="summary-icon purple">◇</span><p>Available now</p><strong>2</strong></div><span className="trend positive">Ready</span></div>
        <div className="summary-card"><div><span className="summary-icon blue">▣</span><p>Active builds</p><strong>{projects.length}</strong></div><span className="trend">In progress</span></div>
        <div className="summary-card"><div><span className="summary-icon navy">✓</span><p>Final stages</p><strong>1</strong></div><span className="trend positive">On track</span></div>
      </section>
      <section className="board-section">
        <div className="section-heading"><div><p className="eyebrow">Domain board</p><h2>Website workspace</h2></div><div className="board-tools"><button>All developers⌄</button><button>Filter</button></div></div>
        <div className="kanban-board">
          {columns.map((column) => {
            const items = domains.filter((domain) => domain.status === column);
            return (
              <div className="kanban-column" key={column}>
                <div className="column-heading"><span className={`status-dot ${column.toLowerCase().replaceAll(' ', '-')}`} /><h3>{column}</h3><span>{items.length}</span></div>
                <div className="column-stack">
                  {items.map((domain) => <DomainCard domain={domain} key={domain.id} onClick={() => onDomain(domain)} />)}
                  {column === 'Available' && <button className="empty-action" onClick={onLaunch}>＋ Start with an available domain</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function DomainCard({ domain, onClick }: { domain: Domain; onClick: () => void }) {
  return (
    <button className="domain-card" onClick={onClick}>
      <div className="domain-top"><span className="domain-icon">◎</span><span className="more">•••</span></div>
      <strong>{domain.domain}</strong><p>{domain.client}</p>
      {domain.stage && <span className="stage-label">{domain.stage}</span>}
      <div className="progress-track"><span style={{ width: `${Math.max(domain.progress, 6)}%` }} /></div>
      <div className="domain-meta"><span>{domain.progress}%</span>{domain.developer ? <span className={`developer ${domain.developer.toLowerCase()}`}>{domain.developer.slice(0, 1)} · {domain.developer}</span> : <span>Unallocated</span>}</div>
    </button>
  );
}

function DomainsView({ onDomain, onNotice, notice }: { onDomain: (domain: Domain) => void; onNotice: (message: string) => void; notice: string }) {
  return (
    <div className="view-stack">
      <section className="mini-summary-row">
        <div><span>Connected domains</span><strong>6</strong><small>All responding</small></div>
        <div><span>Available</span><strong>2</strong><small>Ready for allocation</small></div>
        <div><span>Templates loaded</span><strong>2</strong><small>Approved versions</small></div>
        <div><span>Needs attention</span><strong>0</strong><small>No current blockers</small></div>
      </section>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Connected installations</p><h2>WordPress domain inventory</h2></div><button className="outline-button" onClick={() => onNotice('Demo connection check completed: all domains responded.')}>Check all connections</button></div>
        {notice && <p className="notice inline-notice">{notice}</p>}
        <div className="data-table domain-table">
          <div className="table-row table-head"><span>Domain</span><span>Status</span><span>WordPress</span><span>Template</span><span>Host</span><span /></div>
          {domains.map((domain) => (
            <button className="table-row" key={domain.id} onClick={() => onDomain(domain)}>
              <span className="table-primary"><i className="connection-dot" /><span><strong>{domain.domain}</strong><small>{domain.client}</small></span></span>
              <span><b className={`status-pill ${domain.status.toLowerCase().replaceAll(' ', '-')}`}>{domain.status}</b></span>
              <span>{domain.wordpress}</span><span>{domain.template}</span><span>{domain.host}</span><span className="table-arrow">→</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProjectsView({ onProject }: { onProject: (project: Project) => void }) {
  return (
    <div className="view-stack">
      <section className="project-overview-strip">
        <div><span className="large-number">6</span><span><strong>Active projects</strong><small>4 template · 2 custom</small></span></div>
        <div className="agent-load"><span><b>Barry</b><small>4 projects</small></span><div><i style={{ width: '80%' }} /></div></div>
        <div className="agent-load purple-load"><span><b>Clive</b><small>2 projects</small></span><div><i style={{ width: '50%' }} /></div></div>
      </section>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Current work</p><h2>Project pipeline</h2></div><div className="board-tools"><button>All stages⌄</button><button>All developers⌄</button></div></div>
        <div className="project-list">
          {projects.map((project) => (
            <button className="project-row" key={project.id} onClick={() => onProject(project)}>
              <span className={`project-avatar small ${project.developer.toLowerCase()}`}>{project.client.slice(0, 1)}</span>
              <span className="project-name"><strong>{project.client}</strong><small>{project.domain}</small></span>
              <span className="project-type"><b>{project.buildType}</b><small>{project.developer}</small></span>
              <span className="project-stage"><strong>{project.stage}</strong><small>Next: {project.next}</small></span>
              <span className="project-progress"><b>{project.progress}%</b><span className="progress-track"><i style={{ width: `${project.progress}%` }} /></span></span>
              <span className="project-due"><small>Target</small><strong>{project.due}</strong></span>
              <span className="table-arrow">→</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function AgentActivity({ filter, onFilter }: { filter: 'All' | Developer; onFilter: (filter: 'All' | Developer) => void }) {
  const visibleActivities = activities.filter((activity) => filter === 'All' || activity.agent === filter);
  return (
    <div className="agent-layout">
      <section className="agent-column">
        <div className="agent-card">
          <div className="agent-card-top"><span className="avatar barry">B</span><span><strong>Barry</strong><small>Template website builder</small></span><b className="online-pill">Working</b></div>
          <p>Building service pages for Northstar Exterior.</p>
          <div className="agent-stats"><span><small>Assigned</small><strong>4</strong></span><span><small>In review</small><strong>1</strong></span><span><small>Capacity</small><strong>80%</strong></span></div>
        </div>
        <div className="agent-card">
          <div className="agent-card-top"><span className="avatar clive">C</span><span><strong>Clive</strong><small>Custom website builder</small></span><b className="online-pill purple">Review</b></div>
          <p>Waiting for Clearwater home-page feedback.</p>
          <div className="agent-stats"><span><small>Assigned</small><strong>2</strong></span><span><small>In review</small><strong>1</strong></span><span><small>Capacity</small><strong>50%</strong></span></div>
        </div>
        <div className="connection-card"><span className="connection-symbol">⌁</span><div><strong>Codex reporting link</strong><p>Last dummy update received 2 minutes ago.</p></div><b>Connected</b></div>
      </section>
      <section className="panel activity-panel">
        <div className="section-heading"><div><p className="eyebrow">Latest reports</p><h2>Activity timeline</h2></div><div className="filter-tabs">{(['All', 'Barry', 'Clive'] as const).map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => onFilter(item)}>{item}</button>)}</div></div>
        <div className="timeline">
          {visibleActivities.map((activity, index) => (
            <div className="timeline-item" key={`${activity.time}-${index}`}>
              <span className={`timeline-dot ${activity.agent.toLowerCase()}`} />
              <span className="timeline-time">{activity.time}</span>
              <span className="timeline-copy"><strong>{activity.project}</strong><p><b>{activity.agent}</b> · {activity.action}</p></span>
              <b className="activity-status">{activity.status}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
