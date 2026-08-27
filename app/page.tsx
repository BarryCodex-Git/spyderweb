'use client';

import { useState } from 'react';
import Image from 'next/image';

type DomainStatus = 'Available' | 'Template Loaded' | 'Busy Working' | 'Final Stages';
type Domain = {
  id: number;
  domain: string;
  client: string;
  status: DomainStatus;
  developer?: 'Barry' | 'Clive';
  stage?: string;
  progress: number;
};

const columns: DomainStatus[] = ['Available', 'Template Loaded', 'Busy Working', 'Final Stages'];
const domains: Domain[] = [
  { id: 1, domain: 'dev-01.spyderweb.co.za', client: 'Ready for a new project', status: 'Available', progress: 0 },
  { id: 2, domain: 'dev-02.spyderweb.co.za', client: 'Ready for a new project', status: 'Available', progress: 0 },
  { id: 3, domain: 'dev-03.spyderweb.co.za', client: 'Approved template ready', status: 'Template Loaded', progress: 15 },
  { id: 4, domain: 'northstar-dev.co.za', client: 'Northstar Exterior', status: 'Busy Working', developer: 'Barry', stage: 'Build All Service Pages', progress: 62 },
  { id: 5, domain: 'clearwater-dev.co.za', client: 'Clearwater Plumbing', status: 'Busy Working', developer: 'Clive', stage: 'Review Home Page', progress: 38 },
  { id: 6, domain: 'oakandstone-dev.co.za', client: 'Oak & Stone', status: 'Final Stages', developer: 'Barry', stage: 'Launch Preparation', progress: 91 },
];

export default function Home() {
  const [launchOpen, setLaunchOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [developer, setDeveloper] = useState<'Barry' | 'Clive'>('Barry');
  const [launchStep, setLaunchStep] = useState(1);
  const [notice, setNotice] = useState('');

  function openLaunch() {
    setSelectedDomain(null);
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
          <button className="nav-item active"><span>⌂</span>Dashboard</button>
          <button className="nav-item"><span>◇</span>Domains</button>
          <button className="nav-item"><span>▤</span>Projects</button>
          <button className="nav-item"><span>◉</span>Agent activity</button>
        </nav>
        <div className="sidebar-status"><span className="pulse" /><div><strong>Codex link ready</strong><small>Reporting connection</small></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">Website production</p><h1>Good morning</h1><p className="subheading">See what is available, active, and ready for review.</p></div>
          <div className="topbar-actions">
            <div className="user-chip"><span>BC</span><div><strong>Barry Codex</strong><small>Administrator</small></div></div>
            <button className="primary-button" onClick={openLaunch}><span>＋</span> Launch Build</button>
          </div>
        </header>

        <section className="summary-row" aria-label="Platform summary">
          <div className="summary-card featured"><div><span className="summary-icon">⌁</span><p>Development domains</p><strong>{domains.length}</strong></div><span className="trend">All connected</span></div>
          <div className="summary-card"><div><span className="summary-icon purple">◇</span><p>Available now</p><strong>2</strong></div><span className="trend positive">Ready</span></div>
          <div className="summary-card"><div><span className="summary-icon blue">▣</span><p>Active builds</p><strong>2</strong></div><span className="trend">In progress</span></div>
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
                    {items.map((domain) => (
                      <button className="domain-card" key={domain.id} onClick={() => { setNotice(''); setSelectedDomain(domain); }}>
                        <div className="domain-top"><span className="domain-icon">◎</span><span className="more">•••</span></div>
                        <strong>{domain.domain}</strong><p>{domain.client}</p>
                        {domain.stage && <span className="stage-label">{domain.stage}</span>}
                        <div className="progress-track"><span style={{ width: `${Math.max(domain.progress, 6)}%` }} /></div>
                        <div className="domain-meta"><span>{domain.progress}%</span>{domain.developer ? <span className={`developer ${domain.developer.toLowerCase()}`}>{domain.developer.slice(0, 1)} · {domain.developer}</span> : <span>Unallocated</span>}</div>
                      </button>
                    ))}
                    {column === 'Available' && <button className="empty-action" onClick={openLaunch}>＋ Start with an available domain</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </section>

      {selectedDomain && !launchOpen && (
        <div className="drawer-backdrop" onClick={() => setSelectedDomain(null)}>
          <aside className="detail-drawer" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedDomain(null)}>×</button>
            <span className="drawer-logo"><Image src="/spyderweb-logo.png" alt="" width={61} height={61} /></span>
            <p className="eyebrow">Domain details</p><h2>{selectedDomain.domain}</h2><p className="drawer-copy">{selectedDomain.client}</p>
            <div className="detail-list"><div><span>Status</span><strong>{selectedDomain.status}</strong></div><div><span>Developer</span><strong>{selectedDomain.developer ?? 'Not allocated'}</strong></div><div><span>Current stage</span><strong>{selectedDomain.stage ?? 'Ready to begin'}</strong></div></div>
            <h3>Safe domain actions</h3>
            <button className="secondary-button" onClick={() => setNotice('Demo only: WordPress installation check prepared.')}>Fresh WordPress installation</button>
            <button className="secondary-button" onClick={() => setNotice('Demo only: approved template import prepared.')}>Load approved template</button>
            {notice && <p className="notice">{notice}</p>}
            <small className="simulation-note">First GUI preview — no live server actions are connected.</small>
          </aside>
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
