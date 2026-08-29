'use client';

import Image from 'next/image';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type View = 'Dashboard' | 'Domains' | 'Projects' | 'Agent Activity' | 'Settings';
type Developer = 'Barry' | 'Clive';
type DomainStatus = 'Available' | 'Template Loaded' | 'Busy Working' | 'Final Stages' | 'Needs Inspection';
type HostingProvider = 'cPanel' | 'Hostinger';
type ActionToastStatus = 'progress' | 'success' | 'warning' | 'error';

type ActionToast = {
  id: string;
  status: ActionToastStatus;
  title: string;
  message: string;
};

type Domain = {
  id: number | string;
  domain: string;
  client: string;
  status: DomainStatus;
  developer?: Developer;
  stage?: string;
  progress: number;
  wordpress: string;
  host: string;
  template: string;
  source?: 'demo' | 'cpanel';
  domainType?: string;
  phpVersion?: string | null;
};

type HostingConnection = {
  id: string;
  provider: 'cpanel';
  name: string;
  baseUrl: string;
  username: string;
  primaryDomain: string;
  status: string;
  mode: 'read_only' | 'managed_write';
  credentialStorage: 'encrypted_cloud';
  capabilities: Record<string, boolean>;
  writeActionsEnabled: number;
  destructiveActionsEnabled: number;
  confirmationPolicy: string;
  lastSyncAt: string;
};

type HostingDomain = {
  id?: string;
  connectionId: string;
  domain: string;
  domainType: string;
  documentRoot: string | null;
  phpVersion: string | null;
  wordpressStatus: string;
  wordpressVersion: string | null;
  wordpressSiteName: string | null;
  wordpressUrl: string | null;
  wordpressInstallationId: string | null;
  wordpressSource: string | null;
  workflowStatusOverride: string | null;
  sslStatus: string;
  lastSeenAt: string;
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
  { label: 'Settings', icon: '⚙' },
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
  Settings: {
    eyebrow: 'Platform administration',
    title: 'Settings',
    subtitle: 'Manage your owner account, future users, and hosting connections.',
  },
};

const columns: DomainStatus[] = ['Needs Inspection', 'Available', 'Template Loaded', 'Busy Working', 'Final Stages'];
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

const demoDomains: Domain[] = [
  { id: 1, domain: 'dev-01.spyderweb.co.za', client: 'Ready for a new project', status: 'Available', progress: 0, wordpress: '6.8.2', host: 'HostAfrica', template: 'None', source: 'demo' },
  { id: 2, domain: 'dev-02.spyderweb.co.za', client: 'Ready for a new project', status: 'Available', progress: 0, wordpress: '6.8.2', host: 'HostAfrica', template: 'None', source: 'demo' },
  { id: 3, domain: 'dev-03.spyderweb.co.za', client: 'Approved template ready', status: 'Template Loaded', progress: 15, wordpress: '6.8.2', host: 'HostAfrica', template: 'Barry Core v4', source: 'demo' },
  { id: 4, domain: 'northstar-dev.co.za', client: 'Northstar Exterior', status: 'Busy Working', developer: 'Barry', stage: 'Build All Service Pages', progress: 62, wordpress: '6.8.2', host: 'HostAfrica', template: 'Barry Core v4', source: 'demo' },
  { id: 5, domain: 'clearwater-dev.co.za', client: 'Clearwater Plumbing', status: 'Busy Working', developer: 'Clive', stage: 'Review Home Page', progress: 38, wordpress: '6.8.2', host: 'HostAfrica', template: 'Custom', source: 'demo' },
  { id: 6, domain: 'oakandstone-dev.co.za', client: 'Oak & Stone', status: 'Final Stages', developer: 'Barry', stage: 'Launch Preparation', progress: 91, wordpress: '6.8.2', host: 'HostAfrica', template: 'Barry Core v4', source: 'demo' },
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

function mapHostingDomains(records: HostingDomain[], connections: HostingConnection[]): Domain[] {
  return records.map((record) => {
    const connection = connections.find((item) => item.id === record.connectionId);
    const installed = record.wordpressStatus === 'installed';
    const isTemplate = installed && /(\btemplate\b|\bnew\s+(?:client\s+)?build\b)/i.test(
      `${record.domain} ${record.wordpressSiteName ?? ''}`,
    );
    const isManuallyAvailable = record.workflowStatusOverride === 'Available';
    const status: DomainStatus = isManuallyAvailable
      ? 'Available'
      : isTemplate
        ? 'Template Loaded'
        : installed
          ? 'Busy Working'
          : record.wordpressStatus === 'not_installed' ? 'Available' : 'Needs Inspection';
    const client = isManuallyAvailable || record.wordpressStatus === 'not_installed'
      ? 'Ready for a new project'
      : isTemplate
        ? 'Approved template ready'
        : installed
          ? record.wordpressSiteName ?? 'WordPress installation detected'
          : 'WordPress scan pending';
    return {
      id: record.id ?? `${record.connectionId}:${record.domain}`,
      domain: record.domain,
      client,
      status,
      progress: 0,
      wordpress:
        installed
          ? record.wordpressVersion ? `Installed · ${record.wordpressVersion}` : 'Installed'
          : record.wordpressStatus === 'not_installed' ? 'Not installed' : 'Scan pending',
      host: connection?.name ?? 'Connected cPanel',
      template: isTemplate
        ? record.wordpressSiteName ?? 'Template detected'
        : installed ? 'Client website' : 'None',
      source: 'cpanel',
      domainType: record.domainType,
      phpVersion: record.phpVersion,
    };
  });
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>('Dashboard');
  const [launchOpen, setLaunchOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [developer, setDeveloper] = useState<Developer>('Barry');
  const [launchStep, setLaunchStep] = useState(1);
  const [notice, setNotice] = useState('');
  const [activityFilter, setActivityFilter] = useState<'All' | Developer>('All');
  const [hostingProvider, setHostingProvider] = useState<HostingProvider | null>(null);
  const [hostingNotice, setHostingNotice] = useState('');
  const [hostingBusy, setHostingBusy] = useState(false);
  const [hostingConnections, setHostingConnections] = useState<HostingConnection[]>([]);
  const [managedDomains, setManagedDomains] = useState<Domain[]>([]);
  const [inventoryIsLive, setInventoryIsLive] = useState(false);
  const [inventoryRefreshing, setInventoryRefreshing] = useState(false);
  const [inventoryLastRefreshedAt, setInventoryLastRefreshedAt] = useState<string | null>(null);
  const [hostingSyncingId, setHostingSyncingId] = useState<string | null>(null);
  const [hostingModeChangingId, setHostingModeChangingId] = useState<string | null>(null);
  const [domainAvailabilityId, setDomainAvailabilityId] = useState<string | null>(null);
  const [settingsHostingNotice, setSettingsHostingNotice] = useState('');
  const [actionToasts, setActionToasts] = useState<ActionToast[]>([]);
  const toastTimers = useRef(new Map<string, number>());
  const automaticHostingScanStarted = useRef(false);
  const inventoryRequestCounter = useRef(0);

  const copy = viewCopy[activeView];
  const selectedStageIndex = selectedProject
    ? Math.max(buildStages.indexOf(selectedProject.stage), 0)
    : 0;

  const dismissActionToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    toastTimers.current.delete(id);
    setActionToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showActionToast = useCallback((toast: ActionToast) => {
    const existingTimer = toastTimers.current.get(toast.id);
    if (existingTimer) window.clearTimeout(existingTimer);
    setActionToasts((current) => [toast, ...current.filter((item) => item.id !== toast.id)].slice(0, 4));

    if (toast.status !== 'progress') {
      const timer = window.setTimeout(
        () => {
          setActionToasts((current) => current.filter((item) => item.id !== toast.id));
          toastTimers.current.delete(toast.id);
        },
        toast.status === 'success' ? 6000 : 10000,
      );
      toastTimers.current.set(toast.id, timer);
    }
  }, []);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const loadHostingInventory = useCallback(async (showIndicator = false) => {
    const requestId = ++inventoryRequestCounter.current;
    if (showIndicator) setInventoryRefreshing(true);
    try {
      const response = await fetch('/api/hosting/cpanel', { cache: 'no-store' });
      if (!response.ok) return null;
      const data = (await response.json()) as {
        connections: HostingConnection[];
        domains: HostingDomain[];
      };
      if (requestId !== inventoryRequestCounter.current) return data;
      setHostingConnections((current) => JSON.stringify(current) === JSON.stringify(data.connections) ? current : data.connections);
      if (data.domains.length > 0) {
        const mappedDomains = mapHostingDomains(data.domains, data.connections);
        setManagedDomains((current) => JSON.stringify(current) === JSON.stringify(mappedDomains) ? current : mappedDomains);
        setInventoryIsLive(true);
      } else if (data.connections.length === 0) {
        setManagedDomains(demoDomains);
        setInventoryIsLive(false);
      }
      setInventoryLastRefreshedAt(new Date().toISOString());
      return data;
    } catch {
      // The existing demo remains visible until a live inventory is available.
      return null;
    } finally {
      if (showIndicator) setInventoryRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refreshVisibleInventory = () => {
      if (active && document.visibilityState === 'visible') void loadHostingInventory();
    };
    const initialTimer = window.setTimeout(() => {
      if (active && document.visibilityState === 'visible') void loadHostingInventory(true);
    }, 0);
    const timer = window.setInterval(refreshVisibleInventory, 20_000);
    window.addEventListener('focus', refreshVisibleInventory);
    document.addEventListener('visibilitychange', refreshVisibleInventory);
    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisibleInventory);
      document.removeEventListener('visibilitychange', refreshVisibleInventory);
    };
  }, [loadHostingInventory]);

  const hostingConnectionIds = hostingConnections.map((connection) => connection.id).sort().join(',');

  useEffect(() => {
    if (!hostingConnectionIds) return;
    const connectionIds = hostingConnectionIds.split(',');

    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      const showAutomaticProgress = !automaticHostingScanStarted.current;
      if (showAutomaticProgress) {
        automaticHostingScanStarted.current = true;
        showActionToast({
          id: 'automatic-wordpress-scan',
          status: 'progress',
          title: 'Scanning WordPress installations',
          message: 'Matching the connected cPanel domains to live WordPress installations and site names.',
        });
      }
      await Promise.allSettled(
        connectionIds.map((connectionId) =>
          fetch(`/api/hosting/cpanel/${connectionId}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );
      const data = await loadHostingInventory();
      if (!data) {
        if (showAutomaticProgress) {
          showActionToast({
            id: 'automatic-wordpress-scan',
            status: 'warning',
            title: 'WordPress scan needs another attempt',
            message: 'The saved cPanel connection remains available. Use Scan domains & WordPress in Settings to retry.',
          });
        }
        return;
      }
      const mappedDomains = mapHostingDomains(data.domains, data.connections);
      if (showAutomaticProgress) {
        const installedCount = data.domains.filter((domain) => domain.wordpressStatus === 'installed').length;
        const pendingCount = data.domains.filter((domain) => domain.wordpressStatus === 'not_checked').length;
        showActionToast({
          id: 'automatic-wordpress-scan',
          status: pendingCount ? 'warning' : 'success',
          title: pendingCount ? 'WordPress scan needs attention' : 'WordPress scan complete',
          message: pendingCount
            ? `${installedCount} installations identified. ${pendingCount} domains still need inspection.`
            : `${installedCount} WordPress installations matched to ${mappedDomains.length} connected domains.`,
        });
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [hostingConnectionIds, loadHostingInventory, showActionToast]);

  function changeView(view: View) {
    setActiveView(view);
    setSelectedDomain(null);
    setSelectedProject(null);
    setHostingProvider(null);
    setNotice('');
  }

  function openLaunch() {
    setSelectedDomain(null);
    setSelectedProject(null);
    setLaunchStep(1);
    setNotice('');
    setLaunchOpen(true);
  }

  function openDashboardDomain(domain: Domain) {
    setNotice('');
    const project = projects.find((item) => item.domain === domain.domain);
    const isActive = domain.status === 'Busy Working' || domain.status === 'Final Stages';

    if (isActive && project) {
      setSelectedDomain(null);
      setSelectedProject(project);
      return;
    }

    setSelectedProject(null);
    setSelectedDomain(domain);
  }

  function continueLaunch() {
    if (launchStep < 3) {
      setLaunchStep((step) => step + 1);
      return;
    }
    setNotice(`Demo build prepared for ${developer}. No live domain was changed.`);
  }

  async function connectHosting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hostingProvider !== 'cPanel') {
      setHostingNotice('Hostinger will be connected after the cPanel integration is proven.');
      showActionToast({ id: 'hostinger-connect', status: 'error', title: 'Hostinger is not ready yet', message: 'Complete the cPanel connection first. The Hostinger connector is still in preparation.' });
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    setHostingBusy(true);
    setHostingNotice('Testing the secure connection and scanning domains…');
    showActionToast({ id: 'cpanel-connect', status: 'progress', title: 'Connecting to cPanel', message: 'Checking the encrypted credentials and scanning the account for domains and subdomains.' });
    try {
      const response = await fetch('/api/hosting/cpanel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          baseUrl: formData.get('baseUrl'),
          username: formData.get('username'),
          token: formData.get('token'),
          primaryDomain: formData.get('primaryDomain'),
          readOnly: formData.get('readOnly') === 'on',
        }),
      });
      const result = (await response.json()) as { error?: string; message?: string; scanStatus?: 'complete' | 'needs_attention'; wordpressScanStatus?: 'complete' | 'needs_attention' };
      if (!response.ok) throw new Error(result.error || 'The cPanel connection failed.');
      const tokenInput = form.elements.namedItem('token') as HTMLInputElement | null;
      if (tokenInput) tokenInput.value = '';
      await loadHostingInventory();
      const successMessage = result.message || 'cPanel connected in read-only mode.';
      setHostingNotice(successMessage);
      showActionToast({
        id: 'cpanel-connect',
        status: result.scanStatus === 'needs_attention' || result.wordpressScanStatus === 'needs_attention' ? 'warning' : 'success',
        title: result.scanStatus === 'needs_attention' || result.wordpressScanStatus === 'needs_attention' ? 'cPanel connected · scan pending' : 'cPanel connected',
        message: successMessage,
      });
      if (result.scanStatus === 'complete') {
        setHostingProvider(null);
        setActiveView('Dashboard');
        setSelectedDomain(null);
        setSelectedProject(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The cPanel connection failed.';
      setHostingNotice(message);
      showActionToast({ id: 'cpanel-connect', status: 'error', title: 'Connection failed', message });
    } finally {
      setHostingBusy(false);
    }
  }

  async function syncHostingConnection(connectionId: string) {
    setHostingSyncingId(connectionId);
    setSettingsHostingNotice('Synchronising domains and WordPress installations…');
    showActionToast({ id: `cpanel-sync-${connectionId}`, status: 'progress', title: 'Scanning cPanel', message: 'Refreshing domains, WordPress installations, versions and site names.' });
    try {
      const response = await fetch(`/api/hosting/cpanel/${connectionId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = (await response.json()) as { error?: string; message?: string; scanStatus?: 'complete' | 'needs_attention'; wordpressScanStatus?: 'complete' | 'needs_attention' };
      if (!response.ok) throw new Error(result.error || 'The cPanel synchronisation failed.');
      await loadHostingInventory();
      const successMessage = result.message || 'The cPanel inventory is current.';
      setSettingsHostingNotice(successMessage);
      showActionToast({
        id: `cpanel-sync-${connectionId}`,
        status: result.scanStatus === 'needs_attention' || result.wordpressScanStatus === 'needs_attention' ? 'warning' : 'success',
        title: result.scanStatus === 'needs_attention' || result.wordpressScanStatus === 'needs_attention' ? 'Connected · scan pending' : 'Scan complete',
        message: successMessage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The cPanel synchronisation failed.';
      setSettingsHostingNotice(message);
      showActionToast({ id: `cpanel-sync-${connectionId}`, status: 'error', title: 'Scan failed', message });
    } finally {
      setHostingSyncingId(null);
    }
  }

  async function changeHostingMode(connection: HostingConnection) {
    const nextMode = connection.mode === 'managed_write' ? 'read_only' : 'managed_write';
    setHostingModeChangingId(connection.id);
    setSettingsHostingNotice(
      nextMode === 'managed_write'
        ? `Enabling managed access for ${connection.name}…`
        : `Returning ${connection.name} to read-only mode…`,
    );
    showActionToast({ id: `cpanel-mode-${connection.id}`, status: 'progress', title: 'Changing access mode', message: nextMode === 'managed_write' ? `Enabling managed access for ${connection.name}.` : `Returning ${connection.name} to read-only mode.` });
    try {
      const response = await fetch(`/api/hosting/cpanel/${connection.id}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextMode }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || 'The hosting access mode could not be changed.');
      await loadHostingInventory();
      const successMessage = result.message || 'The hosting access mode was updated.';
      setSettingsHostingNotice(successMessage);
      showActionToast({ id: `cpanel-mode-${connection.id}`, status: 'success', title: 'Access mode updated', message: successMessage });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The hosting access mode could not be changed.';
      setSettingsHostingNotice(message);
      showActionToast({ id: `cpanel-mode-${connection.id}`, status: 'error', title: 'Access change failed', message });
    } finally {
      setHostingModeChangingId(null);
    }
  }

  async function markDomainAvailable(domain: Domain) {
    if (typeof domain.id !== 'string' || domain.source !== 'cpanel') return;
    setDomainAvailabilityId(domain.id);
    showActionToast({
      id: `domain-available-${domain.id}`,
      status: 'progress',
      title: 'Updating domain workflow',
      message: `Marking ${domain.domain} as available in SpyderWeb.`,
    });
    try {
      const response = await fetch(`/api/hosting/domains/${domain.id}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || 'The domain could not be marked available.');
      await loadHostingInventory();
      setSelectedDomain(null);
      showActionToast({
        id: `domain-available-${domain.id}`,
        status: 'success',
        title: 'Domain available',
        message: result.message || `${domain.domain} is ready for a new build.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The domain could not be marked available.';
      showActionToast({ id: `domain-available-${domain.id}`, status: 'error', title: 'Update failed', message });
    } finally {
      setDomainAvailabilityId(null);
    }
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
            <div className="user-chip"><span>AO</span><div><strong>Owner Account</strong><small>Admin / Owner</small></div></div>
            <button className="primary-button" onClick={openLaunch}><span>＋</span> Launch Build</button>
          </div>
        </header>

        {activeView === 'Dashboard' && <Dashboard domains={managedDomains} onDomain={openDashboardDomain} onLaunch={openLaunch} inventoryIsLive={inventoryIsLive} inventoryRefreshing={inventoryRefreshing} inventoryLastRefreshedAt={inventoryLastRefreshedAt} />}
        {activeView === 'Domains' && <DomainsView domains={managedDomains} onDomain={setSelectedDomain} onNotice={setNotice} notice={notice} inventoryIsLive={inventoryIsLive} />}
        {activeView === 'Projects' && <ProjectsView onProject={setSelectedProject} />}
        {activeView === 'Agent Activity' && <AgentActivity filter={activityFilter} onFilter={setActivityFilter} />}
        {activeView === 'Settings' && <SettingsView connections={hostingConnections} syncingId={hostingSyncingId} modeChangingId={hostingModeChangingId} notice={settingsHostingNotice} onSync={syncHostingConnection} onModeChange={changeHostingMode} onConnect={(provider) => { setHostingNotice(''); setHostingProvider(provider); }} />}
      </section>

      {hostingProvider && !launchOpen && (
        <div className="project-modal-backdrop" onClick={() => setHostingProvider(null)}>
          <section className="hosting-setup-modal" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setHostingProvider(null)}>×</button>
            <header className="hosting-modal-header">
              <span className={`provider-logo ${hostingProvider.toLowerCase()}`}>{hostingProvider === 'cPanel' ? 'cP' : 'H'}</span>
              <div><p className="eyebrow">Hosting connection</p><h2>Connect {hostingProvider}</h2><p>Start with a safe scan, then choose the access mode for the saved connection.</p></div>
              <span className={`setup-status ${hostingConnections.length ? 'connected' : ''}`}>{hostingConnections.length ? 'Connections saved' : 'Ready to connect'}</span>
            </header>
            <div className="hosting-modal-body">
              <section className="connection-guide">
                <p className="eyebrow">Step-by-step guide</p>
                <h3>Before entering anything</h3>
                <div className="guide-steps">
                  {(hostingProvider === 'cPanel' ? [
                    ['Open cPanel', 'Sign in to the cPanel account that owns your development subdomains.'],
                    ['Create an API token', 'Open Security → Manage API Tokens and create one named “SpyderWeb Local Connector”.'],
                    ['Copy the account details', 'Keep the secure cPanel URL, username and new token ready. Do not use your normal password.'],
                    ['Start read-only', 'The first connection will only discover domains and available hosting features.'],
                  ] : [
                    ['Open hPanel', 'Sign in to the Hostinger account that owns your development websites.'],
                    ['Create an API token', 'Open Account settings → API and create a token named “SpyderWeb Local Connector”.'],
                    ['Copy the token', 'Hostinger only displays the token once, so keep it ready for the secure connector.'],
                    ['Start read-only', 'The first connection will inventory websites and supported API actions without changing them.'],
                  ]).map(([title, description], index) => (
                    <div className="guide-step" key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div></div>
                  ))}
                </div>
                <div className="security-callout"><strong>Encrypted connection storage</strong><p>The token is encrypted before storage using a private SpyderWeb key. It is never returned to the browser and cannot be read from the database by itself.</p></div>
              </section>

              <form className="hosting-form" onSubmit={connectHosting}>
                <div><p className="eyebrow">Connection details</p><h3>{hostingProvider} account</h3><p>{hostingProvider === 'cPanel' ? 'Authorise this account once, save it securely, and import its domain inventory.' : 'This provider is still in preparation.'}</p></div>
                <label>Connection name<input name="name" required placeholder={hostingProvider === 'cPanel' ? 'Main DEV cPanel' : 'Hostinger DEV account'} /></label>
                {hostingProvider === 'cPanel' && <><label>Secure cPanel URL<input name="baseUrl" required type="url" placeholder="https://server.example.com:2083" /></label><label>cPanel username<input name="username" required autoComplete="username" placeholder="Account username" /></label></>}
                <label>{hostingProvider === 'cPanel' ? 'cPanel API token' : 'Hostinger API token'}<input name="token" required type="password" autoComplete="new-password" placeholder="Paste the API token" /></label>
                <label>Primary development domain<input name="primaryDomain" required placeholder="dev.example.co.za" /></label>
                <label className="read-only-option"><input name="readOnly" type="checkbox" defaultChecked required /><span><strong>Start safely in read-only mode</strong><small>After the first scan, you can switch this saved connection to Managed access—or return it to read-only—at any time.</small></span></label>
                {hostingNotice && <p className="notice">{hostingNotice}</p>}
                <div className="hosting-form-actions"><button className="text-button" type="button" onClick={() => setHostingProvider(null)}>Close</button><button className="primary-button" type="submit" disabled={hostingBusy}>{hostingBusy ? 'Connecting…' : 'Save connection & scan'}</button></div>
              </form>
            </div>
          </section>
        </div>
      )}

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
              <div><span>PHP version</span><strong>{selectedDomain.phpVersion ?? 'Not reported'}</strong></div>
              <div><span>Template</span><strong>{selectedDomain.template}</strong></div>
              <div><span>Current stage</span><strong>{selectedDomain.stage ?? 'Ready to begin'}</strong></div>
            </div>
            <h3>Safe domain actions</h3>
            {selectedDomain.source === 'cpanel' && selectedDomain.status !== 'Available' && (
              <button
                className="secondary-button available-workflow-button"
                disabled={domainAvailabilityId === selectedDomain.id}
                onClick={() => markDomainAvailable(selectedDomain)}
              >
                {domainAvailabilityId === selectedDomain.id ? 'Updating…' : 'Mark available for a new build'}
              </button>
            )}
            <button className="secondary-button" disabled>Fresh WordPress installation · Locked</button>
            <button className="secondary-button" disabled>Load approved template · Locked</button>
            {notice && <p className="notice">{notice}</p>}
            <small className="simulation-note">Marking a domain available changes only its SpyderWeb workflow status. WordPress is not altered. Hosting write actions remain protected.</small>
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
            {launchStep === 2 && <div className="launch-panel"><h3>Select a development domain</h3><p>Choose one of the available, connected WordPress spaces.</p><div className="domain-options">{managedDomains.filter((domain) => domain.status === 'Available').map((domain) => <button className={selectedDomain?.id === domain.id ? 'selected' : ''} key={domain.id} onClick={() => setSelectedDomain(domain)}><span>◎</span><strong>{domain.domain}</strong><small>Available</small></button>)}</div></div>}
            {launchStep === 3 && <div className="launch-panel"><h3>Client intake & assets</h3><p>Add the essentials now. The detailed form can follow inside the project.</p><label>Client or business name<input placeholder="e.g. Acme Plumbing" /></label><label>Project notes<textarea placeholder="What does the client need?" rows={3} /></label><button className="upload-box"><span>↑</span><strong>Upload client assets</strong><small>Logos, photos and documents</small></button></div>}
            {notice && <p className="notice success">{notice}</p>}
            <div className="modal-footer"><button className="text-button" onClick={() => launchStep > 1 ? setLaunchStep((step) => step - 1) : setLaunchOpen(false)}>{launchStep > 1 ? 'Back' : 'Cancel'}</button><button className="primary-button" onClick={continueLaunch}>{launchStep < 3 ? 'Continue' : 'Prepare Build'}</button></div>
          </section>
        </div>
      )}

      <aside className="action-toast-region" aria-label="Action updates" aria-live="polite">
        {actionToasts.map((toast) => (
          <section className={`action-toast ${toast.status}`} key={toast.id} role={toast.status === 'error' ? 'alert' : 'status'}>
            <span className="toast-status-icon" aria-hidden="true">{toast.status === 'progress' ? '' : toast.status === 'success' ? '✓' : '!'}</span>
            <div><strong>{toast.title}</strong><p>{toast.message}</p></div>
            <button type="button" aria-label={`Dismiss ${toast.title}`} onClick={() => dismissActionToast(toast.id)}>×</button>
          </section>
        ))}
      </aside>
    </main>
  );
}

function Dashboard({ domains, onDomain, onLaunch, inventoryIsLive, inventoryRefreshing, inventoryLastRefreshedAt }: { domains: Domain[]; onDomain: (domain: Domain) => void; onLaunch: () => void; inventoryIsLive: boolean; inventoryRefreshing: boolean; inventoryLastRefreshedAt: string | null }) {
  const availableCount = domains.filter((domain) => domain.status === 'Available').length;
  const finalCount = domains.filter((domain) => domain.status === 'Final Stages').length;
  const refreshTime = inventoryLastRefreshedAt
    ? new Date(inventoryLastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  return (
    <>
      <section className="summary-row" aria-label="Platform summary">
        <div className="summary-card featured"><div><span className="summary-icon">⌁</span><p>Development domains</p><strong>{domains.length}</strong></div><span className="trend">{inventoryIsLive ? 'Live inventory' : 'Demo data'}</span></div>
        <div className="summary-card"><div><span className="summary-icon purple">◇</span><p>Available now</p><strong>{availableCount}</strong></div><span className="trend positive">Ready</span></div>
        <div className="summary-card"><div><span className="summary-icon blue">▣</span><p>Active builds</p><strong>{projects.length}</strong></div><span className="trend">In progress</span></div>
        <div className="summary-card"><div><span className="summary-icon navy">✓</span><p>Final stages</p><strong>{finalCount}</strong></div><span className="trend positive">On track</span></div>
      </section>
      <section className="board-section">
        <div className="section-heading"><div><p className="eyebrow">Domain board</p><h2>Website workspace</h2></div><div className="board-heading-actions"><span className={`live-refresh-pill ${inventoryRefreshing ? 'refreshing' : ''}`}><i />{inventoryRefreshing ? 'Refreshing live data…' : refreshTime ? `Live · updated ${refreshTime}` : 'Connecting to live data…'}</span><div className="board-tools"><button>All developers⌄</button><button>Filter</button></div></div></div>
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

function DomainsView({ domains, onDomain, onNotice, notice, inventoryIsLive }: { domains: Domain[]; onDomain: (domain: Domain) => void; onNotice: (message: string) => void; notice: string; inventoryIsLive: boolean }) {
  const availableCount = domains.filter((domain) => domain.status === 'Available').length;
  const templateCount = domains.filter((domain) => domain.status === 'Template Loaded').length;
  const attentionCount = domains.filter((domain) => domain.wordpress === 'Scan pending').length;
  return (
    <div className="view-stack">
      <section className="mini-summary-row">
        <div><span>{inventoryIsLive ? 'Connected domains' : 'Demo domains'}</span><strong>{domains.length}</strong><small>{inventoryIsLive ? 'Imported from cPanel' : 'Waiting for connection'}</small></div>
        <div><span>Available</span><strong>{availableCount}</strong><small>Ready for allocation</small></div>
        <div><span>Templates loaded</span><strong>{templateCount}</strong><small>Detected from site names</small></div>
        <div><span>Needs inspection</span><strong>{attentionCount}</strong><small>WordPress data pending</small></div>
      </section>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Connected installations</p><h2>WordPress domain inventory</h2></div><button className="outline-button" onClick={() => onNotice(inventoryIsLive ? 'SpyderWeb scans domains and WordPress installations automatically. Use Sync now in Settings whenever you want an immediate refresh.' : 'Connect cPanel in Settings to replace this demo inventory with live domains.')}>{inventoryIsLive ? 'Scan information' : 'Connection status'}</button></div>
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

function SettingsView({ connections, syncingId, modeChangingId, notice, onSync, onModeChange, onConnect }: { connections: HostingConnection[]; syncingId: string | null; modeChangingId: string | null; notice: string; onSync: (connectionId: string) => void; onModeChange: (connection: HostingConnection) => void; onConnect: (provider: HostingProvider) => void }) {
  const cpanelConnections = connections.filter((connection) => connection.provider === 'cpanel');
  const managedConnections = cpanelConnections.filter((connection) => connection.mode === 'managed_write');
  return (
    <div className="settings-stack">
      <section className="settings-account-grid">
        <div className="owner-card">
          <span className="owner-avatar">AO</span>
          <div><p className="eyebrow">Your account</p><h2>Owner Account</h2><p>Full access to projects, agents, hosting connections and future user permissions.</p></div>
          <span className="owner-role">Admin / Owner</span>
        </div>
        <div className="future-users-card">
          <div><p className="eyebrow">User access</p><h2>Team dashboards</h2><p>Additional users will receive their own dashboard and only the access you assign.</p></div>
          <button className="outline-button" disabled>＋ Add user · Later</button>
        </div>
      </section>

      <section className="panel hosting-settings-panel">
        <div className="section-heading"><div><p className="eyebrow">Hosting accounts</p><h2>Connect your development hosting</h2><p>Start with read-only discovery. cPanel project reporting remains completely separate.</p></div><span className={`connection-count ${connections.length ? 'connected' : ''}`}>{connections.length} connected</span></div>
        <div className="hosting-provider-grid">
          <article className="hosting-provider-card">
            <div className="provider-card-top"><span className="provider-logo cpanel">cP</span><span className={`not-connected ${cpanelConnections.length ? 'connected' : ''}`}>{cpanelConnections.length ? `${cpanelConnections.length} connected` : 'Not connected'}</span></div>
            <h3>cPanel</h3><p>Connect the shared hosting account that manages your main development domain and WordPress subdomains.</p>
            <ul><li>Discover and save live domains</li><li>Check available cPanel features</li><li>Switch each account between read-only and managed access</li></ul>
            {cpanelConnections.length > 0 && <div className="saved-connections">{cpanelConnections.map((connection) => (
              <div className="connection-summary" key={connection.id}>
                <div className="connection-details"><span><strong>{connection.name}</strong><b className={`connection-health-pill ${connection.status === 'connected_scan_issue' ? 'warning' : ''}`}>{connection.status === 'connected_scan_issue' ? 'Connected · scan needed' : 'Connected'}</b><b className={`access-mode-pill ${connection.mode === 'managed_write' ? 'managed' : ''}`}>{connection.mode === 'managed_write' ? 'Managed access' : 'Read only'}</b></span><small>{connection.baseUrl}</small><small>{connection.status === 'connected_scan_issue' ? 'Authentication verified · live inventory not imported yet' : `Last scan: ${new Date(connection.lastSyncAt).toLocaleString()}`}</small></div>
                <div className="connection-controls">
                  <button className="outline-button" disabled={syncingId === connection.id || modeChangingId === connection.id} onClick={() => onSync(connection.id)}>{syncingId === connection.id ? 'Scanning…' : connection.status === 'connected_scan_issue' ? 'Retry scan' : 'Scan domains & WordPress'}</button>
                  <button className={`access-mode-button ${connection.mode === 'managed_write' ? 'read-only' : ''}`} disabled={syncingId === connection.id || modeChangingId === connection.id} onClick={() => onModeChange(connection)}>{modeChangingId === connection.id ? 'Changing…' : connection.mode === 'managed_write' ? 'Return to read only' : 'Enable managed access'}</button>
                </div>
              </div>
            ))}</div>}
            {notice && <p className="notice settings-hosting-notice">{notice}</p>}
            <button className="primary-button" onClick={() => onConnect('cPanel')}>{cpanelConnections.length ? '＋ Add another cPanel' : 'Set up cPanel'}</button>
          </article>
          <article className="hosting-provider-card">
            <div className="provider-card-top"><span className="provider-logo hostinger">H</span><span className="not-connected">Not connected</span></div>
            <h3>Hostinger</h3><p>Connect Hostinger through its API and discover which website-management actions your account supports.</p>
            <ul><li>Inventory hosted websites</li><li>Detect WordPress installations</li><li>Show available API controls</li></ul>
            <button className="primary-button" onClick={() => onConnect('Hostinger')}>Set up Hostinger</button>
          </article>
        </div>
      </section>

      <section className="safety-policy-panel">
        <div><span className="safety-icon">✓</span><div><p className="eyebrow">Hosting safety</p><h2>Reversible access with a destructive-action lock</h2><p>Ordinary write access can be enabled per connection and switched off instantly. Delete, overwrite and reinstall actions remain separately protected.</p></div></div>
        <div className="safety-rules">
          <span><b>1</b><strong>Fresh backup required</strong><small>No overwrite or deletion without a verified restore point.</small></span>
          <span><b>2</b><strong>Exact domain confirmation</strong><small>The full domain must be entered before the action can continue.</small></span>
          <span><b>3</b><strong>Owner one-time code</strong><small>A separate expiring approval code will be required when write access is introduced.</small></span>
        </div>
        <strong className={`hard-lock ${managedConnections.length ? 'managed' : ''}`}>{managedConnections.length ? `${managedConnections.length} connection${managedConnections.length === 1 ? '' : 's'} in managed mode · destructive lock active` : 'All connections currently read only'}</strong>
      </section>

      <section className="settings-note"><span>⌁</span><div><strong>Multiple hosting spaces supported</strong><p>Add every authorised cPanel account here. Each connection remains saved and can be synchronised independently; Hostinger accounts will use the same model when that connector is added.</p></div></section>
    </div>
  );
}
