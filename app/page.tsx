'use client';

import Image from 'next/image';
import { type DragEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { PROJECT_STAGES, domainWorkflowForStage, suggestedProgress, type ProjectStage } from '@/lib/project-workflow';
import { isSelectableExistingDomain, suggestedSubdomainLabel } from '@/lib/launch-project';
import { emptyClientIntake, type ClientIntake } from '@/lib/client-intake';

type View = 'Dashboard' | 'New Project' | 'Domains' | 'Projects' | 'Agent Activity' | 'Settings';
type Developer = 'Barry' | 'Clive' | 'Owner Account';
type DomainStatus = 'Available' | 'Template Loaded' | 'Busy Working' | 'Final Stages' | 'Needs Inspection';
type HostingProvider = 'cPanel' | 'Hostinger';
type ActionToastStatus = 'progress' | 'success' | 'warning' | 'error';
type ProjectStageStatus = 'not_started' | 'in_progress' | 'awaiting_review' | 'blocked' | 'completed';

type ActionToast = {
  id: string;
  status: ActionToastStatus;
  title: string;
  message: string;
};

type WordPressAction = 'install' | 'clone_template' | 'create_restore_point' | 'delete_oldest_backup' | 'apply_php_profile';

type BackupStatus = {
  domainId: string;
  count: number;
  latestCreatedAt: string | null;
  latestSizeBytes: number | null;
  totalSizeBytes: number | null;
};

type AuditEvent = {
  id: string;
  action: string;
  target: string | null;
  outcome: string;
  details: Record<string, unknown>;
  createdAt: string;
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
  wordpressUrl?: string | null;
  host: string;
  template: string;
  source?: 'demo' | 'cpanel';
  domainType?: string;
  phpVersion?: string | null;
  softLocked?: boolean;
  connectionMode?: 'read_only' | 'managed_write';
  connectionId?: string;
  operationalReady?: boolean;
  restorePointAt?: string | null;
  phpProfileStatus?: string;
  wordpressActivityAt?: string | null;
  needsInspection?: boolean;
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
  operationalCredentialStatus: 'not_configured' | 'verified' | 'failed';
  defaultTemplateDomain: string | null;
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
  assignedDeveloper: string | null;
  wordpressSoftLocked: number;
  sslStatus: string;
  lastSeenAt: string;
  restorePointAt: string | null;
  phpProfileStatus: string;
  wordpressActivityAt: string | null;
};

type Project = {
  id: string;
  domainId: string | null;
  client: string;
  buildType: 'Template' | 'Custom';
  developer: Developer;
  domain: string;
  stage: string;
  stageStatus: ProjectStageStatus;
  progress: number;
  due: string;
  next: string;
  intakeNotes: string;
  lifecycleStatus: string;
  lastReportedBy: string;
  createdAt: string;
  updatedAt: string;
  sortOrder: number;
  wordpressActivityAt: string | null;
  latestActivityAt: string;
  latestActivitySource: 'wordpress' | 'project';
};

type TemplateSlot = {
  id: string; slotNumber: number; name: string; sourceDomainId: string | null;
  sourceDomain: string | null; connectionId: string | null; siteName: string | null; previewUrl: string | null;
  updatedAt?: string;
};

type ProjectEvent = {
  id: string;
  projectId: string;
  project: string;
  developer: Developer;
  eventType: string;
  source: string;
  stage: string | null;
  stageStatus: ProjectStageStatus | null;
  note: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

const navItems: { label: View; icon: string }[] = [
  { label: 'Dashboard', icon: '⌂' },
  { label: 'New Project', icon: '＋' },
  { label: 'Projects', icon: '▤' },
  { label: 'Agent Activity', icon: '◉' },
  { label: 'Domains', icon: '◇' },
  { label: 'Settings', icon: '⚙' },
];

const viewCopy: Record<View, { eyebrow: string; title: string; subtitle: string }> = {
  Dashboard: {
    eyebrow: 'Website production',
    title: 'Good morning',
    subtitle: 'See what is available, active, and ready for review.',
  },
  'New Project': {
    eyebrow: 'Fast website deployment',
    title: 'Launch New Project',
    subtitle: 'Create a subdomain and load the right WordPress template in one guided action.',
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

const workflowStatuses: DomainStatus[] = ['Needs Inspection', 'Available', 'Template Loaded', 'Busy Working', 'Final Stages'];
const columns: Exclude<DomainStatus, 'Needs Inspection'>[] = ['Available', 'Template Loaded', 'Busy Working', 'Final Stages'];
const assignableDevelopers: Developer[] = ['Barry', 'Clive', 'Owner Account'];
const buildStages = [...PROJECT_STAGES];
const projectStageStatuses: { value: ProjectStageStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_review', label: 'Awaiting review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
];

const demoDomains: Domain[] = [
  { id: 1, domain: 'dev-01.spyderweb.co.za', client: 'Ready for a new project', status: 'Available', progress: 0, wordpress: '6.8.2', host: 'HostAfrica', template: 'None', source: 'demo' },
  { id: 2, domain: 'dev-02.spyderweb.co.za', client: 'Ready for a new project', status: 'Available', progress: 0, wordpress: '6.8.2', host: 'HostAfrica', template: 'None', source: 'demo' },
  { id: 3, domain: 'dev-03.spyderweb.co.za', client: 'Approved template ready', status: 'Template Loaded', progress: 15, wordpress: '6.8.2', host: 'HostAfrica', template: 'Barry Core v4', source: 'demo' },
  { id: 4, domain: 'northstar-dev.co.za', client: 'Northstar Exterior', status: 'Busy Working', developer: 'Barry', stage: 'Build All Service Pages', progress: 62, wordpress: '6.8.2', host: 'HostAfrica', template: 'Barry Core v4', source: 'demo' },
  { id: 5, domain: 'clearwater-dev.co.za', client: 'Clearwater Plumbing', status: 'Busy Working', developer: 'Clive', stage: 'Review Home Page', progress: 38, wordpress: '6.8.2', host: 'HostAfrica', template: 'Custom', source: 'demo' },
  { id: 6, domain: 'oakandstone-dev.co.za', client: 'Oak & Stone', status: 'Final Stages', developer: 'Barry', stage: 'Launch Preparation', progress: 91, wordpress: '6.8.2', host: 'HostAfrica', template: 'Barry Core v4', source: 'demo' },
];

function mapHostingDomains(records: HostingDomain[], connections: HostingConnection[]): Domain[] {
  return records.map((record) => {
    const connection = connections.find((item) => item.id === record.connectionId);
    const installed = record.wordpressStatus === 'installed';
    const isTemplate = installed && /(\btemplate\b|\bnew\s+(?:client\s+)?build\b)/i.test(
      `${record.domain} ${record.wordpressSiteName ?? ''}`,
    );
    const rawWorkflowOverride = record.workflowStatusOverride as DomainStatus | null;
    const needsInspection = rawWorkflowOverride === 'Needs Inspection'
      || !['installed', 'not_installed'].includes(record.wordpressStatus)
      || /(?:failed|error|attention|pending)/i.test(record.phpProfileStatus || '');
    const workflowOverride = workflowStatuses.includes(rawWorkflowOverride as DomainStatus)
      ? rawWorkflowOverride
      : null;
    const status: DomainStatus = workflowOverride === 'Needs Inspection'
      ? 'Available'
      : workflowOverride
      ? workflowOverride
      : isTemplate
        ? 'Template Loaded'
        : installed
          ? 'Busy Working'
          : record.wordpressStatus === 'not_installed' ? 'Available' : 'Needs Inspection';
    const client = status === 'Available' || record.wordpressStatus === 'not_installed'
      ? 'Ready for a new project'
      : status === 'Template Loaded'
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
      wordpressUrl: record.wordpressUrl,
      host: connection?.name ?? 'Connected cPanel',
      template: status === 'Template Loaded'
        ? record.wordpressSiteName ?? 'Template loaded'
        : installed && status === 'Available' ? 'Clean WordPress' : installed ? 'Client website' : 'None',
      source: 'cpanel',
      domainType: record.domainType,
      phpVersion: record.phpVersion,
      developer: assignableDevelopers.includes(record.assignedDeveloper as Developer)
        ? record.assignedDeveloper as Developer
        : undefined,
      softLocked: record.wordpressSoftLocked !== 0,
      connectionMode: connection?.mode,
      connectionId: record.connectionId,
      operationalReady: connection?.operationalCredentialStatus === 'verified',
      restorePointAt: record.restorePointAt,
      phpProfileStatus: record.phpProfileStatus,
      wordpressActivityAt: record.wordpressActivityAt,
      needsInspection,
    };
  });
}

function websiteLinks(domainOrUrl: string) {
  const rawValue = domainOrUrl.trim();
  const candidate = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported website protocol');
    const website = url.toString().replace(/\/+$/, '');
    return { website, wordpressAdmin: `${website}/wp-admin/` };
  } catch {
    const fallback = `https://${rawValue.replace(/^\/+|\/+$/g, '')}`;
    return { website: fallback, wordpressAdmin: `${fallback}/wp-admin/` };
  }
}

function SiteQuickLinks({ domainOrUrl, label }: { domainOrUrl: string; label: string }) {
  const links = websiteLinks(domainOrUrl);
  return (
    <nav className="site-quick-links" aria-label={`${label} website shortcuts`}>
      <a href={links.website} target="_blank" rel="noopener noreferrer" title={`Open ${label} website`}><span aria-hidden="true">↗</span>Open Website</a>
      <a href={links.wordpressAdmin} target="_blank" rel="noopener noreferrer" title={`Open ${label} WordPress admin`}><span className="wp-mark" aria-hidden="true">W</span>WP Admin</a>
    </nav>
  );
}

function formatBackupDate(value: string | null | undefined) {
  if (!value) return 'No restore point saved';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved date unavailable';
  return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatStorage(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Size not reported';
  if (value < 1024) return `${Math.round(value)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = value / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && amount >= 1024; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)} ${unit}`;
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>('Dashboard');
  const [launchOpen, setLaunchOpen] = useState(false);
  const [manualProjectOpen, setManualProjectOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [developer, setDeveloper] = useState<Developer>('Barry');
  const [launchStep, setLaunchStep] = useState(1);
  const [notice, setNotice] = useState('');
  const [activityFilter, setActivityFilter] = useState<'All' | Developer>('All');
  const [hostingProvider, setHostingProvider] = useState<HostingProvider | null>(null);
  const [wordpressActivationConnection, setWordpressActivationConnection] = useState<HostingConnection | null>(null);
  const [wordpressActivationBusy, setWordpressActivationBusy] = useState(false);
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
  const [domainControlBusy, setDomainControlBusy] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [settingsHostingNotice, setSettingsHostingNotice] = useState('');
  const [actionToasts, setActionToasts] = useState<ActionToast[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [wordpressAction, setWordpressAction] = useState<{ domain: Domain; action: WordPressAction; detectedSiteName?: string } | null>(null);
  const [wordpressActionBusy, setWordpressActionBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupLoadingDomainId, setBackupLoadingDomainId] = useState<string | null>(null);
  const [projectRecords, setProjectRecords] = useState<Project[]>([]);
  const [projectEvents, setProjectEvents] = useState<ProjectEvent[]>([]);
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectIntakeEditor, setProjectIntakeEditor] = useState<{ project: Project; intake: ClientIntake } | null>(null);
  const [projectIntakeBusy, setProjectIntakeBusy] = useState(false);
  const [projectActivityRefreshing, setProjectActivityRefreshing] = useState(false);
  const [projectActivityCheckedAt, setProjectActivityCheckedAt] = useState<string | null>(null);
  const [templateSlots, setTemplateSlots] = useState<TemplateSlot[]>([]);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [launchClientName, setLaunchClientName] = useState('');
  const [launchNotes, setLaunchNotes] = useState('');
  const toastTimers = useRef(new Map<string, number>());
  const inventoryRequestCounter = useRef(0);
  const newestInventorySyncRef = useRef(0);

  const copy = viewCopy[activeView];
  const selectedStageIndex = selectedProject
    ? Math.max(buildStages.indexOf(selectedProject.stage as (typeof buildStages)[number]), 0)
    : 0;
  const selectedProjectEvents = selectedProject
    ? projectEvents.filter((event) => event.projectId === selectedProject.id)
    : [];
  const projectAwareDomains = managedDomains.map((domain) => {
    const project = projectRecords.find((item) => item.domain === domain.domain);
    const projectWorkflow = project ? domainWorkflowForStage(project.stage as ProjectStage) : null;
    return project
      ? { ...domain, client: project.client, developer: project.developer, stage: project.stage,
          progress: project.progress, status: projectWorkflow ?? domain.status }
      : domain;
  });
  const selectedDomainProject = selectedDomain
    ? projectRecords.find((project) => project.domain === selectedDomain.domain)
    : null;
  const selectedDomainOperational = Boolean(
    selectedDomain?.operationalReady && selectedDomain.connectionMode === 'managed_write',
  );

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
        audit: AuditEvent[];
      };
      if (requestId !== inventoryRequestCounter.current) return data;
      const responseSync = Math.max(0, ...data.connections.map((connection) => Date.parse(connection.lastSyncAt) || 0));
      if (responseSync < newestInventorySyncRef.current) return data;
      newestInventorySyncRef.current = responseSync;
      setHostingConnections((current) => JSON.stringify(current) === JSON.stringify(data.connections) ? current : data.connections);
      setAuditEvents(data.audit ?? []);
      if (data.domains.length > 0) {
        const mappedDomains = mapHostingDomains(data.domains, data.connections);
        setManagedDomains((current) => JSON.stringify(current) === JSON.stringify(mappedDomains) ? current : mappedDomains);
        setSelectedDomain((current) => current
          ? mappedDomains.find((domain) => domain.id === current.id) ?? current
          : null);
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

  const loadDomainBackupStatus = useCallback(async (domain: Domain) => {
    if (typeof domain.id !== 'string') return;
    setBackupLoadingDomainId(domain.id);
    try {
      const response = await fetch(`/api/hosting/domains/${domain.id}/wordpress`, { cache: 'no-store' });
      const result = await response.json() as Omit<BackupStatus, 'domainId'> & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Backup information could not be loaded.');
      setBackupStatus({ domainId: domain.id, count: result.count, latestCreatedAt: result.latestCreatedAt, latestSizeBytes: result.latestSizeBytes, totalSizeBytes: result.totalSizeBytes });
    } catch (error) {
      setBackupStatus({ domainId: domain.id, count: 0, latestCreatedAt: domain.restorePointAt ?? null, latestSizeBytes: null, totalSizeBytes: null });
      showActionToast({ id: `backup-status-${domain.id}`, status: 'warning', title: 'Backup status unavailable', message: error instanceof Error ? error.message : 'Backup information could not be loaded.' });
    } finally {
      setBackupLoadingDomainId((current) => current === domain.id ? null : current);
    }
  }, [showActionToast]);

  const loadProjectData = useCallback(async () => {
    try {
      const response = await fetch('/api/projects', { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json() as { projects: Project[]; events: ProjectEvent[] };
      setProjectRecords((current) => JSON.stringify(current) === JSON.stringify(data.projects) ? current : data.projects);
      setProjectEvents((current) => JSON.stringify(current) === JSON.stringify(data.events) ? current : data.events);
      setSelectedProject((current) => current
        ? data.projects.find((project) => project.id === current.id) ?? current
        : null);
      return data;
    } catch {
      return null;
    }
  }, []);

  const refreshProjectActivity = useCallback(async (force = false) => {
    if (document.visibilityState !== 'visible') return;
    setProjectActivityRefreshing(true);
    try {
      const response = await fetch('/api/projects/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }) });
      if (!response.ok) return;
      const result = await response.json() as { checkedAt?: string };
      setProjectActivityCheckedAt(result.checkedAt ?? new Date().toISOString());
      await loadProjectData();
    } finally { setProjectActivityRefreshing(false); }
  }, [loadProjectData]);

  const loadTemplateSlots = useCallback(async () => {
    try {
      const response = await fetch('/api/launch', { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json() as { templates: TemplateSlot[] };
      setTemplateSlots(data.templates);
      return data.templates;
    } catch { return null; }
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

  useEffect(() => {
    let active = true;
    const refreshProjects = () => {
      if (active && document.visibilityState === 'visible') void loadProjectData();
    };
    refreshProjects();
    const timer = window.setInterval(refreshProjects, 30_000);
    window.addEventListener('focus', refreshProjects);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshProjects);
    };
  }, [loadProjectData]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void refreshProjectActivity(false); };
    const initialTimer = window.setTimeout(refresh, 1200);
    const timer = window.setInterval(refresh, 5 * 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [refreshProjectActivity]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTemplateSlots(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTemplateSlots]);

  function changeView(view: View) {
    setActiveView(view);
    setSelectedDomain(null);
    setSelectedProject(null);
    setHostingProvider(null);
    setManualProjectOpen(false);
    setNotice('');
  }

  function openLaunch() {
    setSelectedDomain(null);
    setSelectedProject(null);
    setLaunchStep(1);
    setLaunchClientName('');
    setLaunchNotes('');
    setNotice('');
    setLaunchOpen(false);
    setActiveView('New Project');
  }

  async function saveTemplateSlot(slotNumber: number, name: string, sourceDomainId: string | null) {
    const response = await fetch('/api/launch', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotNumber, name, sourceDomainId }) });
    const result = await response.json() as { error?: string; message?: string; templates?: TemplateSlot[] };
    if (!response.ok) throw new Error(result.error || 'The template could not be saved.');
    if (result.templates) setTemplateSlots(result.templates);
    showActionToast({ id: `template-slot-${slotNumber}`, status: 'success', title: 'Template saved', message: result.message || 'Template updated.' });
  }

  async function openProjectIntakeEditor(project: Project) {
    setProjectIntakeBusy(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/intake`, { cache: 'no-store' });
      const result = await response.json() as { intake?: ClientIntake; error?: string };
      if (!response.ok || !result.intake) throw new Error(result.error || 'The saved client information could not be loaded.');
      setProjectIntakeEditor({ project, intake: { ...emptyClientIntake, ...result.intake } });
    } catch (error) {
      showActionToast({ id: 'project-intake', status: 'error', title: 'Client information unavailable',
        message: error instanceof Error ? error.message : 'The saved client information could not be loaded.' });
    } finally { setProjectIntakeBusy(false); }
  }

  async function saveProjectIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectIntakeEditor) return;
    const { project, intake } = projectIntakeEditor;
    setProjectIntakeBusy(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/intake`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intake }),
      });
      const result = await response.json() as { intake?: ClientIntake; error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || 'The client information could not be saved.');
      await loadProjectData();
      setProjectIntakeEditor(null);
      const download = document.createElement('a');
      download.href = `/api/projects/${project.id}/intake?download=1`;
      download.download = '';
      document.body.appendChild(download);
      download.click();
      download.remove();
      showActionToast({ id: 'project-intake', status: 'success', title: 'Client information saved',
        message: `${result.message || 'The project details were updated.'} A refreshed Word document is downloading.` });
    } catch (error) {
      showActionToast({ id: 'project-intake', status: 'error', title: 'Client information not saved',
        message: error instanceof Error ? error.message : 'The client information could not be saved.' });
    } finally { setProjectIntakeBusy(false); }
  }

  async function launchNewProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const keepingLoadedTemplate = formData.get('templateDecision') === 'keep';
    setLaunchBusy(true);
    showActionToast({ id: 'new-project-launch', status: 'progress', title: 'Launching new project',
      message: keepingLoadedTemplate
        ? 'Saving the project, keeping the loaded template, and preparing the Word document.'
        : 'Installing WordPress, applying the selected template, and preparing the project handover.' });
    try {
      const response = await fetch('/api/launch', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData.entries())) });
      const result = await response.json() as { error?: string; message?: string; projectId?: string };
      if (!response.ok) throw new Error(result.error || 'The project could not be launched.');
      await Promise.all([loadHostingInventory(), loadProjectData(), loadTemplateSlots()]);
      if (result.projectId) {
        const download = document.createElement('a');
        download.href = `/api/projects/${result.projectId}/intake?download=1`;
        download.download = '';
        document.body.appendChild(download);
        download.click();
        download.remove();
      }
      showActionToast({ id: 'new-project-launch', status: 'success', title: 'Project launched',
        message: `${result.message || 'The new project is ready.'} The Word project details are downloading for the manual agent handover.` });
      form.reset();
      setActiveView('Projects');
      return true;
    } catch (error) {
      showActionToast({ id: 'new-project-launch', status: 'error', title: 'Project launch stopped',
        message: error instanceof Error ? error.message : 'The project could not be launched.' });
      return false;
    } finally { setLaunchBusy(false); }
  }

  async function createStandaloneSubdomain(input: { connectionId: string; parentDomain: string; subdomainLabel: string }) {
    const toastId = 'create-subdomain';
    showActionToast({ id: toastId, status: 'progress', title: 'Creating subdomain',
      message: `Creating ${input.subdomainLabel}.${input.parentDomain} in cPanel and verifying it.` });
    try {
      const response = await fetch('/api/hosting/subdomains', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || 'The subdomain could not be created.');
      await Promise.all([loadHostingInventory(true), loadProjectData()]);
      showActionToast({ id: toastId, status: 'success', title: 'Subdomain created',
        message: result.message || 'The new subdomain is available in Domain Management.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The subdomain could not be created.';
      showActionToast({ id: toastId, status: 'error', title: 'Subdomain creation failed', message });
      throw error;
    }
  }

  async function reorderProjects(projectIds: string[]) {
    const previous = projectRecords;
    const byId = new Map(previous.map((project) => [project.id, project]));
    setProjectRecords(projectIds.map((id) => byId.get(id)).filter((item): item is Project => Boolean(item)));
    try {
      const response = await fetch('/api/projects/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectIds }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'The project order could not be saved.');
    } catch (error) {
      setProjectRecords(previous);
      showActionToast({ id: 'project-order', status: 'error', title: 'Order not saved', message: error instanceof Error ? error.message : 'Refresh and try again.' });
    }
  }

  function openDomain(domain: Domain) {
    setNotice('');
    setSelectedProject(null);
    setSelectedAssignee(domain.developer ?? '');
    setSelectedDomain(domain);
    setBackupStatus(null);
    setBackupLoadingDomainId(null);
    if (typeof domain.id === 'string' && domain.wordpress.startsWith('Installed') && domain.operationalReady && domain.connectionMode === 'managed_write') {
      void loadDomainBackupStatus(domain);
    }
  }

  async function continueLaunch() {
    if (launchStep < 3) {
      if (launchStep === 2 && !selectedDomain) {
        showActionToast({ id: 'launch-domain', status: 'warning', title: 'Choose a domain', message: 'Select the development domain that will hold this project.' });
        return;
      }
      setLaunchStep((step) => step + 1);
      return;
    }
    if (!selectedDomain || typeof selectedDomain.id !== 'string' || !launchClientName.trim()) {
      showActionToast({ id: 'launch-project', status: 'warning', title: 'Complete the intake', message: 'Choose a connected domain and enter the client or business name.' });
      return;
    }
    setProjectBusy(true);
    showActionToast({ id: 'launch-project', status: 'progress', title: 'Creating project', message: `Preparing ${launchClientName.trim()} for ${developer}.` });
    try {
      const response = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainId: selectedDomain.id,
          client: launchClientName,
          buildType: developer === 'Barry' ? 'Template' : 'Custom',
          developer,
          stage: 'Setup',
          stageStatus: 'not_started',
          progress: 0,
          nextAction: 'Complete setup and pre-flight check',
          intakeNotes: launchNotes,
          note: 'New client project created from Launch Build.',
        }),
      });
      const result = await response.json() as { error?: string; message?: string; projectId?: string };
      if (!response.ok) throw new Error(result.error || 'The project could not be created.');
      const data = await loadProjectData();
      await loadHostingInventory();
      setLaunchOpen(false);
      setSelectedDomain(null);
      setActiveView('Projects');
      if (result.projectId && data) setSelectedProject(data.projects.find((project) => project.id === result.projectId) ?? null);
      showActionToast({ id: 'launch-project', status: 'success', title: 'Project ready', message: result.message || 'The project is ready for manual progress tracking.' });
    } catch (error) {
      showActionToast({ id: 'launch-project', status: 'error', title: 'Project not created', message: error instanceof Error ? error.message : 'The project could not be created.' });
    } finally {
      setProjectBusy(false);
    }
  }

  async function createManualProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setProjectBusy(true);
    showActionToast({ id: 'manual-project', status: 'progress', title: 'Adding existing project', message: 'Saving its current assignment and workflow stage.' });
    try {
      const response = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainId: formData.get('domainId'),
          client: formData.get('client'),
          buildType: formData.get('buildType'),
          developer: formData.get('developer'),
          stage: formData.get('stage'),
          stageStatus: formData.get('stageStatus'),
          progress: Number(formData.get('progress')),
          due: formData.get('due'),
          nextAction: formData.get('nextAction'),
          note: formData.get('note'),
        }),
      });
      const result = await response.json() as { error?: string; message?: string; projectId?: string };
      if (!response.ok) throw new Error(result.error || 'The project could not be added.');
      const data = await loadProjectData();
      await loadHostingInventory();
      setManualProjectOpen(false);
      if (result.projectId && data) setSelectedProject(data.projects.find((project) => project.id === result.projectId) ?? null);
      showActionToast({ id: 'manual-project', status: 'success', title: 'Project added', message: result.message || 'Manual tracking is now active.' });
    } catch (error) {
      showActionToast({ id: 'manual-project', status: 'error', title: 'Project not added', message: error instanceof Error ? error.message : 'The project could not be added.' });
    } finally {
      setProjectBusy(false);
    }
  }

  async function updateProject(project: Project, body: Record<string, unknown>, toastTitle: string) {
    setProjectBusy(true);
    const toastId = `project-${project.id}`;
    showActionToast({ id: toastId, status: 'progress', title: toastTitle, message: `Updating ${project.client}.` });
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || 'The project could not be updated.');
      await Promise.all([loadProjectData(), loadHostingInventory()]);
      showActionToast({ id: toastId, status: 'success', title: 'Project updated', message: result.message || 'The manual project record is current.' });
    } catch (error) {
      showActionToast({ id: toastId, status: 'error', title: 'Update failed', message: error instanceof Error ? error.message : 'The project could not be updated.' });
    } finally {
      setProjectBusy(false);
    }
  }

  async function selectProjectStage(project: Project, stage: ProjectStage) {
    const isCurrent = project.stage === stage;
    const stageStatus: ProjectStageStatus = isCurrent && project.stageStatus !== 'completed'
      ? 'completed'
      : 'in_progress';
    await updateProject(project, {
      action: 'save',
      stage,
      stageStatus,
      progress: suggestedProgress(stage, stageStatus),
      note: stageStatus === 'completed'
        ? `${stage} marked finished manually.`
        : `${stage} marked busy manually.`,
    }, stageStatus === 'completed' ? 'Marking stage finished' : 'Changing active stage');
  }

  async function moveProjectToFinalStages(domain: Domain) {
    const project = projectRecords.find((item) => item.domain === domain.domain);
    if (!project) {
      showActionToast({ id: `project-drop-${domain.id}`, status: 'warning', title: 'Project record is still loading', message: 'Please try the move again in a moment.' });
      return;
    }
    const stage: ProjectStage = 'Review Full Build';
    await updateProject(project, {
      action: 'save', stage, stageStatus: 'in_progress',
      progress: suggestedProgress(stage, 'in_progress'),
      note: 'Moved manually from Busy Working to Final Stages on the dashboard.',
    }, 'Moving project to Final Stages');
  }

  async function saveProjectUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) return;
    const formData = new FormData(event.currentTarget);
    await updateProject(selectedProject, {
      action: 'save',
      stage: formData.get('stage'),
      stageStatus: formData.get('stageStatus'),
      progress: Number(formData.get('progress')),
      developer: formData.get('developer'),
      due: formData.get('due'),
      nextAction: formData.get('nextAction'),
      note: formData.get('note'),
    }, 'Saving manual progress');
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
          password: formData.get('password'),
          primaryDomain: formData.get('primaryDomain'),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        scanStatus?: 'complete' | 'needs_attention';
        wordpressScanStatus?: 'complete' | 'needs_attention';
        connection?: HostingConnection;
        domains?: HostingDomain[];
      };
      if (!response.ok) throw new Error(result.error || 'The cPanel connection failed.');
      const tokenInput = form.elements.namedItem('token') as HTMLInputElement | null;
      if (tokenInput) tokenInput.value = '';
      const passwordInput = form.elements.namedItem('password') as HTMLInputElement | null;
      if (passwordInput) passwordInput.value = '';
      if (result.connection && result.domains) {
        const connection = result.connection;
        newestInventorySyncRef.current = Math.max(
          newestInventorySyncRef.current,
          Date.parse(connection.lastSyncAt) || Date.now(),
        );
        setHostingConnections((current) => [
          ...current.filter((item) => item.id !== connection.id),
          connection,
        ]);
        const scannedDomains = mapHostingDomains(result.domains, [
          ...hostingConnections.filter((item) => item.id !== connection.id),
          connection,
        ]);
        setManagedDomains((current) => [
          ...current.filter((domain) => domain.connectionId !== connection.id),
          ...scannedDomains,
        ].sort((a, b) => a.domain.localeCompare(b.domain)));
        setInventoryIsLive(true);
        setInventoryLastRefreshedAt(connection.lastSyncAt);
      } else {
        await loadHostingInventory();
      }
      await loadProjectData();
      const successMessage = result.message || 'cPanel connected with management rights active.';
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

  async function activateWordPressManagement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!wordpressActivationConnection) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const connection = wordpressActivationConnection;
    setWordpressActivationBusy(true);
    showActionToast({ id: `wordpress-activate-${connection.id}`, status: 'progress', title: 'Activating WordPress Management', message: 'Verifying Softaculous with a harmless installation-list check. No website will be changed.' });
    try {
      const response = await fetch(`/api/hosting/cpanel/${connection.id}/operational`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: formData.get('password'),
          defaultTemplateDomain: formData.get('defaultTemplateDomain'),
        }),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || 'WordPress Management could not be activated.');
      const passwordInput = form.elements.namedItem('password') as HTMLInputElement | null;
      if (passwordInput) passwordInput.value = '';
      await loadHostingInventory();
      setWordpressActivationConnection(null);
      setSettingsHostingNotice(result.message || 'WordPress Management is active.');
      showActionToast({ id: `wordpress-activate-${connection.id}`, status: 'success', title: 'WordPress Management active', message: result.message || 'Softaculous controls are ready.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'WordPress Management could not be activated.';
      showActionToast({ id: `wordpress-activate-${connection.id}`, status: 'error', title: 'Activation failed', message });
    } finally {
      setWordpressActivationBusy(false);
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
      await loadProjectData();
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
        ? `Resuming WordPress operations for ${connection.name}…`
        : `Pausing WordPress operations for ${connection.name}…`,
    );
    showActionToast({ id: `cpanel-mode-${connection.id}`, status: 'progress', title: 'Updating WordPress operations', message: nextMode === 'managed_write' ? `Resuming WordPress operations for ${connection.name}.` : `Pausing WordPress operations for ${connection.name}.` });
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
      showActionToast({ id: `cpanel-mode-${connection.id}`, status: 'success', title: 'WordPress operations updated', message: successMessage });
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

  async function updateDomainControl(
    domain: Domain,
    action: 'assign_developer' | 'set_soft_lock' | 'set_build_started',
    value: string | boolean | null,
  ) {
    if (typeof domain.id !== 'string' || domain.source !== 'cpanel') return;
    const actionId = `${action}-${domain.id}`;
    setDomainControlBusy(actionId);
    const isLockAction = action === 'set_soft_lock';
    const isBuildAction = action === 'set_build_started';
    showActionToast({
      id: actionId,
      status: 'progress',
      title: isLockAction ? 'Updating WordPress protection' : isBuildAction ? 'Starting home-page build' : 'Updating developer assignment',
      message: isLockAction ? `Updating the soft lock for ${domain.domain}.` : isBuildAction ? `Moving ${domain.domain} into active work.` : `Assigning ${domain.domain}.`,
    });
    try {
      const response = await fetch(`/api/hosting/domains/${domain.id}/controls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLockAction
          ? { action, locked: value }
          : isBuildAction ? { action } : { action, assignedDeveloper: value || null }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || 'The domain control could not be updated.');
      await loadHostingInventory();
      showActionToast({ id: actionId, status: 'success', title: isLockAction ? 'Protection updated' : isBuildAction ? 'Build started' : 'Assignment updated', message: result.message || 'The domain was updated.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The domain control could not be updated.';
      showActionToast({ id: actionId, status: 'error', title: 'Update failed', message });
    } finally {
      setDomainControlBusy(null);
    }
  }

  async function executeWordpressAction(domain: Domain, action: WordPressAction, confirmReplacement = false) {
    if (typeof domain.id !== 'string') return;
    const toastId = `wordpress-${action}-${domain.id}`;
    const actionLabels: Record<WordPressAction, string> = {
      install: 'Installing clean WordPress',
      clone_template: 'Loading the default template',
      create_restore_point: 'Creating a restore point',
      delete_oldest_backup: 'Deleting the oldest backup',
      apply_php_profile: 'Checking and fixing PHP settings',
    };
    setWordpressActionBusy(true);
    showActionToast({ id: toastId, status: 'progress', title: actionLabels[action], message: `Working on ${domain.domain}. This may take a few minutes.` });
    try {
      const response = await fetch(`/api/hosting/domains/${domain.id}/wordpress`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, confirmReplacement }),
      });
      const result = await response.json() as { error?: string; message?: string; warning?: boolean; requiresConfirmation?: boolean; replacementSiteName?: string | null; backup?: Omit<BackupStatus, 'domainId'> };
      if (!response.ok && result.requiresConfirmation) {
        setWordpressAction({ domain, action, detectedSiteName: result.replacementSiteName || undefined });
        showActionToast({ id: toastId, status: 'warning', title: 'Replacement confirmation required', message: result.error || `Confirm the clean replacement of ${domain.domain}.` });
        return;
      }
      if (!response.ok) throw new Error(result.error || 'The WordPress action was blocked.');
      setWordpressAction(null);
      await loadHostingInventory();
      if (result.backup) setBackupStatus({ domainId: domain.id, ...result.backup });
      else if (action === 'install' || action === 'clone_template') setBackupStatus(null);
      showActionToast({
        id: toastId,
        status: result.warning ? 'warning' : 'success',
        title: action === 'apply_php_profile' ? 'PHP settings updated' : result.warning ? 'Action needs verification' : 'Action completed',
        message: result.message || 'The action completed.',
      });
    } catch (error) {
      showActionToast({
        id: toastId,
        status: 'error',
        title: action === 'apply_php_profile' ? 'PHP settings update failed' : 'WordPress action failed',
        message: error instanceof Error ? error.message : 'The hosting action could not be completed.',
      });
    } finally { setWordpressActionBusy(false); }
  }

  async function runWordpressAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!wordpressAction) return;
    await executeWordpressAction(wordpressAction.domain, wordpressAction.action, true);
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
        <div className="sidebar-status"><span className="pulse" /><div><strong>{inventoryIsLive ? 'Hosting inventory live' : 'Connect hosting'}</strong><small>{inventoryIsLive ? 'Agent reporting comes next' : 'No live domains yet'}</small></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="subheading">{copy.subtitle}</p></div>
          <div className="topbar-actions">
            <div className="user-chip"><span>AO</span><div><strong>Owner Account</strong><small>Admin / Owner</small></div></div>
            <button className="primary-button" onClick={openLaunch}><span>＋</span> Launch Build</button>
          </div>
        </header>

        {activeView === 'Dashboard' && <Dashboard domains={projectAwareDomains} onDomain={openDomain} onLaunch={openLaunch} onMoveToFinalStages={moveProjectToFinalStages} inventoryIsLive={inventoryIsLive} inventoryRefreshing={inventoryRefreshing} inventoryLastRefreshedAt={inventoryLastRefreshedAt} />}
        {activeView === 'New Project' && <LaunchProjectView connections={hostingConnections} domains={projectAwareDomains} templates={templateSlots} busy={launchBusy} onSaveTemplate={saveTemplateSlot} onLaunch={launchNewProject} onActivateWordPress={setWordpressActivationConnection} />}
        {activeView === 'Domains' && <DomainsView connections={hostingConnections} domains={projectAwareDomains} onDomain={openDomain} onNotice={setNotice} notice={notice} inventoryIsLive={inventoryIsLive} onCreateSubdomain={createStandaloneSubdomain} />}
        {activeView === 'Projects' && <ProjectsView domains={projectAwareDomains} projects={projectRecords} activityRefreshing={projectActivityRefreshing} activityCheckedAt={projectActivityCheckedAt} onRefreshActivity={() => void refreshProjectActivity(true)} onProject={setSelectedProject} onManageDomains={() => changeView('Domains')} onReorder={reorderProjects} />}
        {activeView === 'Agent Activity' && <AgentActivity auditEvents={auditEvents} projects={projectRecords} projectEvents={projectEvents} filter={activityFilter} onFilter={setActivityFilter} />}
        {activeView === 'Settings' && <SettingsView connections={hostingConnections} syncingId={hostingSyncingId} modeChangingId={hostingModeChangingId} notice={settingsHostingNotice} onSync={syncHostingConnection} onModeChange={changeHostingMode} onActivateWordPress={setWordpressActivationConnection} onConnect={(provider) => { setHostingNotice(''); setHostingProvider(provider); }} />}
      </section>

      {hostingProvider && !launchOpen && (
        <div className="project-modal-backdrop" onClick={() => setHostingProvider(null)}>
          <section className="hosting-setup-modal" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setHostingProvider(null)}>×</button>
            <header className="hosting-modal-header">
              <span className={`provider-logo ${hostingProvider.toLowerCase()}`}>{hostingProvider === 'cPanel' ? 'cP' : 'H'}</span>
              <div><p className="eyebrow">Hosting connection</p><h2>Connect {hostingProvider}</h2><p>Connect the account once to import its inventory and activate management rights.</p></div>
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
                    ['Copy both credentials', 'Keep the secure cPanel URL, username, API token and normal cPanel account password ready.'],
                    ['Connect everything once', 'One submission imports domains and activates PHP and Softaculous WordPress management.'],
                  ] : [
                    ['Open hPanel', 'Sign in to the Hostinger account that owns your development websites.'],
                    ['Create an API token', 'Open Account settings → API and create a token named “SpyderWeb Local Connector”.'],
                    ['Copy the token', 'Hostinger only displays the token once, so keep it ready for the secure connector.'],
                    ['Import inventory', 'The first connection will inventory websites and supported API actions.'],
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
                {hostingProvider === 'cPanel' && <label>cPanel account password<input name="password" required type="password" autoComplete="current-password" placeholder="Normal cPanel login password" /></label>}
                <label>Primary development domain<input name="primaryDomain" required placeholder="dev.example.co.za" /></label>
                <div className="read-only-option"><span aria-hidden="true">✓</span><span><strong>One complete connection</strong><small>The API token handles inventory and PHP. The encrypted account password activates Softaculous WordPress controls in the same setup.</small></span></div>
                {hostingNotice && <p className="notice">{hostingNotice}</p>}
                <div className="hosting-form-actions"><button className="text-button" type="button" onClick={() => setHostingProvider(null)}>Close</button><button className="primary-button" type="submit" disabled={hostingBusy}>{hostingBusy ? 'Connecting everything…' : 'Connect cPanel & activate'}</button></div>
              </form>
            </div>
          </section>
        </div>
      )}

      {wordpressActivationConnection && !launchOpen && (
        <div className="project-modal-backdrop" onClick={() => !wordpressActivationBusy && setWordpressActivationConnection(null)}>
          <section className="hosting-setup-modal" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" disabled={wordpressActivationBusy} onClick={() => setWordpressActivationConnection(null)}>×</button>
            <header className="hosting-modal-header">
              <span className="provider-logo cpanel">WP</span>
              <div><p className="eyebrow">Saved cPanel account</p><h2>Activate WordPress Management</h2><p>{wordpressActivationConnection.name} is already connected. This adds Softaculous install, delete and template-clone access.</p></div>
              <span className="setup-status connected">cPanel connected</span>
            </header>
            <div className="hosting-modal-body">
              <section className="connection-guide">
                <p className="eyebrow">Step-by-step guide</p>
                <h3>One additional permission</h3>
                <div className="guide-steps">
                  {[
                    ['Keep the existing connection', 'Your cPanel API token already manages domains and PHP. Do not create another API token.'],
                    ['Use the cPanel account password', `Enter the normal cPanel password for “${wordpressActivationConnection.username}”. Softaculous does not accept this server’s API token.`],
                    ['Verify without changing anything', 'SpyderWeb first asks Softaculous only to list its WordPress installations. No site is installed, deleted or overwritten.'],
                    ['Save once and reuse', 'After verification, the password is encrypted and WordPress controls become available automatically on every connected domain.'],
                  ].map(([title, description], index) => <div className="guide-step" key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div></div>)}
                </div>
                <div className="security-callout"><strong>No extra API or authenticator required</strong><p>For this hosting account, the existing cPanel API token plus the cPanel account password are sufficient. If the host later enables a separate Softaculous remote API, SpyderWeb can support that as another connection method.</p></div>
              </section>
              <form className="hosting-form" onSubmit={activateWordPressManagement}>
                <div><p className="eyebrow">WordPress access</p><h3>Confirm Softaculous access</h3><p>The password is only stored after the read-only installation check succeeds.</p></div>
                <label>cPanel username<input value={wordpressActivationConnection.username} readOnly aria-readonly="true" /></label>
                <label>cPanel account password<input name="password" required type="password" autoComplete="current-password" placeholder="Enter the normal cPanel login password" /></label>
                <label>Default template domain (optional)<select name="defaultTemplateDomain" defaultValue={wordpressActivationConnection.defaultTemplateDomain || managedDomains.find((domain) => domain.connectionId === wordpressActivationConnection.id && /template/i.test(domain.domain))?.domain || ''}>
                  <option value="">Choose later</option>
                  {managedDomains.filter((domain) => domain.connectionId === wordpressActivationConnection.id).map((domain) => <option value={domain.domain} key={String(domain.id)}>{domain.domain}{/template/i.test(domain.domain) ? ' · detected template' : ''}</option>)}
                </select></label>
                <div className="read-only-option"><span aria-hidden="true">✓</span><span><strong>Verification is read-only</strong><small>Activation only checks the Softaculous installation list. WordPress actions still respect each domain’s soft lock and confirmation prompt.</small></span></div>
                <div className="hosting-form-actions"><button className="text-button" type="button" disabled={wordpressActivationBusy} onClick={() => setWordpressActivationConnection(null)}>Close</button><button className="primary-button" type="submit" disabled={wordpressActivationBusy}>{wordpressActivationBusy ? 'Verifying Softaculous…' : 'Activate WordPress Management'}</button></div>
              </form>
            </div>
          </section>
        </div>
      )}

      {selectedDomain && !launchOpen && (
        <div className="project-modal-backdrop" onClick={() => setSelectedDomain(null)}>
          <section className="domain-control-modal" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedDomain(null)}>×</button>
            <header className="domain-modal-header">
              <span className="drawer-logo"><Image src="/spyderweb-logo.png" alt="" width={61} height={61} /></span>
              <div className="domain-heading-copy">
                <p className="eyebrow">WordPress domain control</p>
                <div className="domain-title-row"><h2>{selectedDomain.domain}</h2><span className={`status-pill ${selectedDomain.status.toLowerCase().replaceAll(' ', '-')}`}>{selectedDomain.status}</span></div>
                <p>{selectedDomain.client}</p>
              </div>
              <div className="modal-header-tools">
                <SiteQuickLinks domainOrUrl={selectedDomain.wordpressUrl || selectedDomain.domain} label={selectedDomain.domain} />
              </div>
            </header>

            <div className="domain-modal-body">
              <div className="domain-control-main">
                <section className="domain-facts-grid">
                  <div><span>WordPress</span><strong>{selectedDomain.wordpress}</strong></div>
                  <div><span>Template</span><strong>{selectedDomain.template}</strong></div>
                  <div><span>PHP / WordPress profile</span><strong>{selectedDomain.phpProfileStatus === 'wordpress_memory_verified' ? `${selectedDomain.phpVersion?.replace(/^(?:ea|alt)-php(\d)(\d)$/i, 'PHP $1.$2') ?? 'PHP verified'} · 768 MB PHP · 512/768 MB WP` : ['recommended_applied', 'wordpress_memory_pending', 'php_runtime_pending'].includes(selectedDomain.phpProfileStatus ?? '') ? 'PHP runtime / memory check needed' : selectedDomain.phpProfileStatus === 'failed' ? 'PHP / WP update failed' : selectedDomain.phpVersion ?? 'Not reported'}</strong></div>
                  <div><span>Hosting</span><strong>{selectedDomain.host}</strong></div>
                </section>

                {(selectedDomain.status === 'Busy Working' || selectedDomain.status === 'Final Stages') ? (
                  <section className="compact-project-report">
                    <div className="modal-section-heading"><div><p className="eyebrow">Project report</p><h3>{selectedDomain.client}</h3></div><span>{selectedDomain.status}</span></div>
                    <div className="compact-report-grid">
                      <div><span>Assigned to</span><strong>{selectedDomainProject?.developer ?? selectedDomain.developer ?? 'Not allocated'}</strong></div>
                      <div><span>Current stage</span><strong>{selectedDomainProject?.stage ?? (selectedDomain.status === 'Final Stages' ? 'Final stages' : 'Needs manual project setup')}</strong></div>
                      <div><span>Stage status</span><strong>{selectedDomainProject?.stageStatus.replaceAll('_', ' ') ?? 'Not tracked yet'}</strong></div>
                      <div><span>Progress</span><strong>{selectedDomainProject ? `${selectedDomainProject.progress}%` : 'Add in Projects'}</strong></div>
                    </div>
                    {selectedDomainProject
                      ? <button className="outline-button compact-project-open" onClick={() => { setSelectedDomain(null); setSelectedProject(selectedDomainProject); setActiveView('Projects'); }}>Open full project workflow</button>
                      : <button className="outline-button compact-project-open" onClick={() => { setSelectedDomain(null); setManualProjectOpen(true); setActiveView('Projects'); }}>Add this project manually</button>}
                  </section>
                ) : (
                  <section className="domain-readiness-card">
                    <p className="eyebrow">Workspace readiness</p>
                    <h3>{selectedDomain.status === 'Template Loaded'
                      ? 'Ready to assign and begin'
                      : selectedDomain.status === 'Available' && selectedDomain.wordpress.startsWith('Installed')
                        ? 'Clean WordPress is installed and ready'
                        : selectedDomain.status === 'Available' ? 'Ready for a fresh WordPress build' : 'Check this domain before using it'}</h3>
                    <p>{selectedDomain.status === 'Template Loaded'
                      ? 'The approved template is loaded. Assign it to a developer or user to move it into active work.'
                      : selectedDomain.status === 'Available' && selectedDomain.wordpress.startsWith('Installed')
                        ? 'A clean WordPress installation was verified at the domain root. It is available for the next project.'
                      : selectedDomain.status === 'Available'
                        ? 'No WordPress installation was detected. This domain is available for the next build.'
                        : 'The domain did not respond reliably during inspection. No destructive action should be taken yet.'}</p>
                  </section>
                )}

                <section className="assignment-card">
                  <div><p className="eyebrow">Ownership</p><h3>Assign to developer</h3><p>Transfer this domain at any stage. Future SpyderWeb users will appear in this same list and receive it on their dashboard.</p></div>
                  <div className="assignment-controls">
                    <select value={selectedAssignee} onChange={(event) => setSelectedAssignee(event.target.value)} aria-label="Assign domain to developer">
                      <option value="">Unassigned</option>
                      {assignableDevelopers.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <button
                      className="primary-button"
                      disabled={domainControlBusy === `assign_developer-${selectedDomain.id}` || selectedAssignee === (selectedDomain.developer ?? '')}
                      onClick={() => updateDomainControl(selectedDomain, 'assign_developer', selectedAssignee || null)}
                    >{selectedDomain.developer ? 'Transfer assignment' : 'Assign to developer'}</button>
                  </div>
                </section>

                {selectedDomain.wordpress.startsWith('Installed') && (
                  <section className="backup-card">
                    <div className="backup-copy">
                      <p className="eyebrow">Backup</p>
                      <h3>Restore points</h3>
                      <p>Softaculous backups are stored by the hosting account and use its available server space. Keep the latest useful restore point and remove older ones when space is tight.</p>
                    </div>
                    <div className="backup-status-grid">
                      <div><span>Latest saved restore point</span><strong>{backupLoadingDomainId === selectedDomain.id ? 'Checking Softaculous…' : formatBackupDate(backupStatus?.domainId === selectedDomain.id ? backupStatus.latestCreatedAt : selectedDomain.restorePointAt)}</strong></div>
                      <div><span>Saved backups</span><strong>{backupLoadingDomainId === selectedDomain.id ? 'Checking…' : backupStatus?.domainId === selectedDomain.id ? `${backupStatus.count} · ${formatStorage(backupStatus.totalSizeBytes)}` : 'Not checked'}</strong></div>
                    </div>
                    <div className="backup-actions">
                      <button className="outline-button" disabled={wordpressActionBusy || !selectedDomainOperational} onClick={() => void executeWordpressAction(selectedDomain, 'create_restore_point')}>Create restore point</button>
                      <button className="outline-button backup-delete-button" disabled={wordpressActionBusy || !selectedDomainOperational || backupLoadingDomainId === selectedDomain.id || backupStatus?.domainId !== selectedDomain.id || backupStatus.count === 0} onClick={() => setWordpressAction({ domain: selectedDomain, action: 'delete_oldest_backup' })}>Delete oldest backup</button>
                    </div>
                  </section>
                )}
              </div>

              <aside className="domain-action-panel">
                <section className={`soft-lock-card ${selectedDomain.softLocked ? 'locked' : 'unlocked'}`}>
                  <span className="lock-symbol">{selectedDomain.softLocked ? '●' : '○'}</span>
                  <div><p className="eyebrow">WordPress soft lock</p><h3>{selectedDomain.softLocked ? 'Protection is on' : 'Domain is unlocked'}</h3><p>{selectedDomain.softLocked ? 'Deletion, overwrite and replacement actions are blocked.' : 'Destructive actions may be prepared, but still require final confirmation.'}</p></div>
                  <button
                    className={selectedDomain.softLocked ? 'outline-button' : 'secondary-button'}
                    disabled={domainControlBusy === `set_soft_lock-${selectedDomain.id}`}
                    onClick={() => updateDomainControl(selectedDomain, 'set_soft_lock', !selectedDomain.softLocked)}
                  >{domainControlBusy === `set_soft_lock-${selectedDomain.id}` ? 'Updating…' : selectedDomain.softLocked ? 'Unlock domain' : 'Turn soft lock on'}</button>
                </section>

                <section className="wordpress-actions-card">
                  <p className="eyebrow">Operational WordPress management</p>
                  <h3>{selectedDomainOperational ? 'Live controls active' : selectedDomain.operationalReady ? 'Operations are paused' : 'WordPress Management required'}</h3>
                  <div className="operation-readiness">
                    <span className="ready">cPanel connected</span>
                    <span className={selectedDomainOperational ? 'ready' : ''}>{selectedDomainOperational ? 'Management active' : selectedDomain.operationalReady ? 'Operations paused' : 'Activate in Settings'}</span>
                  </div>
                  {selectedDomain.operationalReady && selectedDomain.connectionMode !== 'managed_write' && <button className="primary-button operations-setup-button" onClick={() => {
                    const connection = hostingConnections.find((item) => item.id === selectedDomain.connectionId);
                    if (connection) void changeHostingMode(connection);
                  }}>Resume WordPress operations</button>}
                  {!selectedDomain.wordpress.startsWith('Installed') && <>
                    <button className="secondary-button" disabled={wordpressActionBusy || !selectedDomainOperational} onClick={() => void executeWordpressAction(selectedDomain, 'install')}>Install new WordPress</button>
                    <button className="secondary-button" disabled={wordpressActionBusy || !selectedDomainOperational} onClick={() => void executeWordpressAction(selectedDomain, 'clone_template')}>Load default template</button>
                  </>}
                  {selectedDomain.wordpress.startsWith('Installed') && <>
                    <button className="secondary-button" disabled={wordpressActionBusy || selectedDomain.softLocked || !selectedDomainOperational} onClick={() => setWordpressAction({ domain: selectedDomain, action: 'install' })}>{selectedDomain.softLocked ? 'Install new WordPress · unlock first' : 'Install new WordPress'}</button>
                    <button className="secondary-button" disabled={wordpressActionBusy || selectedDomain.softLocked || !selectedDomainOperational} onClick={() => setWordpressAction({ domain: selectedDomain, action: 'clone_template' })}>{selectedDomain.softLocked ? 'Load default template · unlock first' : 'Load default template'}</button>
                  </>}
                  <button className="secondary-button" disabled={wordpressActionBusy} onClick={() => void executeWordpressAction(selectedDomain, 'apply_php_profile')}>Check &amp; fix PHP settings</button>
                  {selectedDomain.status === 'Template Loaded' && <button className="primary-button domain-start-build" disabled={!selectedDomain.developer || domainControlBusy === `set_build_started-${selectedDomain.id}`} onClick={() => updateDomainControl(selectedDomain, 'set_build_started', null)}>{selectedDomain.developer ? 'Start home-page build' : 'Assign a developer before starting'}</button>}
                  {selectedDomain.source === 'cpanel' && selectedDomain.status !== 'Available' && (
                    <button className="secondary-button available-workflow-button" disabled={domainAvailabilityId === selectedDomain.id} onClick={() => markDomainAvailable(selectedDomain)}>
                      {domainAvailabilityId === selectedDomain.id ? 'Updating…' : 'Mark available for a new build'}
                    </button>
                  )}
                  <small>{!selectedDomain.operationalReady ? 'Open Settings and activate WordPress Management for this saved cPanel account. Domain and PHP access remain connected.' : selectedDomain.softLocked ? 'The soft lock blocks every action that would replace an existing WordPress website. Backups and PHP maintenance remain available.' : 'Install new WordPress and Load default template both remove and verify any existing WordPress installation first. The confirmation names the website that will be replaced.'}</small>
                </section>
                {notice && <p className="notice">{notice}</p>}
              </aside>
            </div>
          </section>
        </div>
      )}

      {wordpressAction && (
        <div className="project-modal-backdrop operation-confirm-backdrop" onClick={() => !wordpressActionBusy && setWordpressAction(null)}>
          <form className="operation-confirm-modal" onSubmit={runWordpressAction} onClick={(event) => event.stopPropagation()}>
            <button className="close-button" type="button" disabled={wordpressActionBusy} onClick={() => setWordpressAction(null)}>×</button>
            <span className={`operation-icon ${wordpressAction.action === 'delete_oldest_backup' ? 'danger' : ''}`}>{wordpressAction.action === 'delete_oldest_backup' ? '!' : '✓'}</span>
            <p className="eyebrow">Live WordPress action</p>
            <h2>{({ install: 'Install new WordPress', clone_template: 'Load the default template', create_restore_point: 'Create a restore point', delete_oldest_backup: 'Delete the oldest backup', apply_php_profile: 'Check and fix PHP settings' } as Record<WordPressAction, string>)[wordpressAction.action]}</h2>
            <p>This will run against <strong>{wordpressAction.domain.domain}</strong> through the verified cPanel management connection.</p>
            {wordpressAction.action === 'delete_oldest_backup' && <div className="danger-callout"><strong>Delete the oldest saved restore point?</strong><span>This removes one old backup archive from the hosting account to recover server space. It does not change the live WordPress website, but the deleted restore point cannot be used again.</span></div>}
            {wordpressAction.action === 'install' && <div className="danger-callout"><strong>This will delete “{wordpressAction.detectedSiteName || wordpressAction.domain.client || wordpressAction.domain.domain}”.</strong><span>SpyderWeb will remove the current WordPress files, database and database user, verify that the installation is gone, and only then install clean WordPress. This cannot run while the domain is soft locked.</span></div>}
            {wordpressAction.action === 'clone_template' && <div className="danger-callout"><strong>This will delete “{wordpressAction.detectedSiteName || wordpressAction.domain.client || wordpressAction.domain.domain}”.</strong><span>SpyderWeb will remove the current WordPress files, database and database user, verify that the installation is gone, and then clone the default template directly onto the empty domain. This cannot run while the domain is soft locked.</span></div>}
            {wordpressAction.action === 'apply_php_profile' && <div className="info-callout">Checks and verifies the complete PHP profile for the selected domain. SpyderWeb selects the host&apos;s recommended supported runtime (PHP 8.3 or 8.4), aligns the domain&apos;s cPanel virtual-host assignment and document-root PHP handler, then verifies 768 MB PHP memory, 512 MB post and upload sizes, 900-second execution and input times, and 5,000 input variables. When WordPress is installed, it also receives at least 512 MB normal memory and 768 MB administrative memory in wp-config.php. Existing files receive dated rollback copies before changes.</div>}
            <div className="operation-confirm-actions"><button className="text-button" type="button" disabled={wordpressActionBusy} onClick={() => setWordpressAction(null)}>Cancel</button><button className={`primary-button ${wordpressAction.action === 'delete_oldest_backup' || wordpressAction.action === 'clone_template' || wordpressAction.action === 'install' ? 'danger-button' : ''}`} type="submit" disabled={wordpressActionBusy}>{wordpressActionBusy ? 'Working…' : wordpressAction.action === 'delete_oldest_backup' ? 'Yes, delete oldest backup' : wordpressAction.action === 'install' ? 'Yes, delete it and install new WordPress' : wordpressAction.action === 'clone_template' ? 'Yes, delete it and load the template' : wordpressAction.action === 'create_restore_point' ? 'Create restore point' : 'Check and fix settings'}</button></div>
          </form>
        </div>
      )}

      {selectedProject && !launchOpen && (
        <div className="project-modal-backdrop" onClick={() => setSelectedProject(null)}>
          <section className="project-control-modal" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedProject(null)}>×</button>
            <header className="project-modal-header">
              <span className={`project-avatar ${selectedProject.developer.toLowerCase()}`}>{selectedProject.client.slice(0, 1)}</span>
              <div className="project-heading-copy">
                <p className="eyebrow">Project control</p>
                <div className="project-title-row"><h2>{selectedProject.client}</h2><span className={`developer modal-owner ${selectedProject.developer.toLowerCase()}`}>{selectedProject.developer}</span></div>
                <p>{selectedProject.buildType} website managed by {selectedProject.developer}</p>
              </div>
              <div className="modal-header-tools">
                <SiteQuickLinks domainOrUrl={selectedProject.domain} label={selectedProject.client} />
                <button className="project-details-download" type="button" disabled={projectIntakeBusy} onClick={() => void openProjectIntakeEditor(selectedProject)}>✎ Edit client info</button>
                <a className="project-details-download" href={`/api/projects/${selectedProject.id}/intake?download=1`}>↓ Project Details</a>
              </div>
            </header>

            <div className="project-modal-body">
              <div className="project-control-main">
                <section className="project-progress-card">
                  <div><p>Overall build progress</p><strong>{selectedProject.progress}%</strong></div>
                  <div className="progress-track large"><span style={{ width: `${selectedProject.progress}%` }} /></div>
                  <div className="progress-card-meta"><span>Current stage: <b>{selectedProject.stage}</b></span><span>Status: <b>{selectedProject.stageStatus.replaceAll('_', ' ')}</b></span><span>Target: <b>{selectedProject.due || 'Not set'}</b></span></div>
                </section>

                <section className="build-stage-panel">
                  <div className="modal-section-heading"><div><p className="eyebrow">Build stages</p><h3>Project pipeline</h3></div><span>{selectedStageIndex + 1} of {buildStages.length}</span></div>
                  <div className="build-stage-list">
                    {buildStages.map((stage, index) => {
                      const state = index < selectedStageIndex || (index === selectedStageIndex && selectedProject.stageStatus === 'completed')
                        ? 'complete'
                        : index === selectedStageIndex && selectedProject.stageStatus !== 'not_started' && selectedProject.stageStatus !== 'blocked'
                          ? 'current'
                          : 'upcoming';
                      return (
                        <button className={`build-stage-item ${state}`} key={stage} type="button" disabled={projectBusy} onClick={() => selectProjectStage(selectedProject, stage)}>
                          <span>{state === 'complete' ? '✓' : index + 1}</span>
                          <div><strong>{stage}</strong><small>{state === 'complete' ? 'Finished' : state === 'current' ? (selectedProject.stageStatus === 'completed' ? 'Finished' : selectedProject.stageStatus === 'not_started' || selectedProject.stageStatus === 'blocked' ? 'Not done' : 'Busy') : 'Not done'}</small></div>
                          {state === 'current' && <b>{selectedProject.stageStatus === 'completed' ? 'Finished' : selectedProject.stageStatus === 'not_started' || selectedProject.stageStatus === 'blocked' ? 'Not done' : 'Busy'}</b>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="stage-colour-key"><span className="finished">Green · finished</span><span className="busy">Orange · busy</span><span className="not-done">Red · not done</span><small>Click a stage to make it busy. Click the active stage again to finish it.</small></div>
                </section>

                <section className="project-history-panel">
                  <div className="modal-section-heading"><div><p className="eyebrow">Progress history</p><h3>Manual updates</h3></div><span>{selectedProjectEvents.length} updates</span></div>
                  <div className="project-history-list">
                    {selectedProjectEvents.slice(0, 8).map((event) => (
                      <div key={event.id}>
                        <span className="history-dot" />
                        <div><strong>{event.note || event.eventType.replaceAll('.', ' ')}</strong><small>{event.source} · {new Date(event.createdAt).toLocaleString()}</small></div>
                        <b>{event.stageStatus?.replaceAll('_', ' ') || 'Updated'}</b>
                      </div>
                    ))}
                    {selectedProjectEvents.length === 0 && <p>No progress updates have been added yet.</p>}
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
                <section className="next-action-card"><span>Next required action</span><strong>{selectedProject.next}</strong><p>This remains manual until Barry and Clive are connected.</p></section>
                <form className="manual-progress-form" key={selectedProject.updatedAt} onSubmit={saveProjectUpdate}>
                  <p className="eyebrow">Manual project controls</p>
                  <label>Assigned developer<select name="developer" defaultValue={selectedProject.developer}>{assignableDevelopers.map((name) => <option key={name}>{name}</option>)}</select></label>
                  <label>Current stage<select name="stage" defaultValue={selectedProject.stage}>{buildStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
                  <label>Stage status<select name="stageStatus" defaultValue={selectedProject.stageStatus}>{projectStageStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
                  <div className="manual-progress-row">
                    <label>Progress %<input name="progress" type="number" min="0" max="100" defaultValue={selectedProject.progress} /></label>
                    <label>Target date<input name="due" defaultValue={selectedProject.due} placeholder="e.g. 12 Sep" /></label>
                  </div>
                  <label>Next required action<input name="nextAction" defaultValue={selectedProject.next} /></label>
                  <label>Progress note<textarea name="note" rows={3} placeholder="What changed or needs attention?" /></label>
                  <button className="primary-button wide" type="submit" disabled={projectBusy}>{projectBusy ? 'Saving…' : 'Save manual update'}</button>
                  <div className="project-quick-actions">
                    <button className="secondary-button" type="button" disabled={projectBusy} onClick={() => updateProject(selectedProject, { action: 'complete_stage' }, 'Completing current stage')}>Complete current stage</button>
                    <button className="secondary-button" type="button" disabled={projectBusy} onClick={() => updateProject(selectedProject, { action: 'request_review' }, 'Requesting review')}>Request review</button>
                  </div>
                </form>
                <small className="simulation-note live-note">Saved updates are live across the Owner dashboard. Agent reporting will use this same history later.</small>
              </aside>
            </div>
          </section>
        </div>
      )}

      {projectIntakeEditor && (
        <div className="project-modal-backdrop intake-editor-backdrop" onClick={() => !projectIntakeBusy && setProjectIntakeEditor(null)}>
          <form className="project-control-modal intake-editor-modal new-project-form" onSubmit={saveProjectIntake} onClick={(event) => event.stopPropagation()}>
            <button className="close-button" type="button" disabled={projectIntakeBusy} onClick={() => setProjectIntakeEditor(null)}>×</button>
            <header className="intake-editor-header full-field">
              <p className="eyebrow">Client information</p>
              <h2>Edit {projectIntakeEditor.project.client}</h2>
              <p>Update the saved intake details without reinstalling WordPress or changing the selected template.</p>
            </header>
            <div className="full-field"><ClientIntakeForm projectName={projectIntakeEditor.project.client} intake={projectIntakeEditor.intake} expanded onChange={(update) => setProjectIntakeEditor((current) => current ? { ...current, intake: update(current.intake) } : current)} /></div>
            <div className="intake-editor-actions full-field"><button className="text-button" type="button" disabled={projectIntakeBusy} onClick={() => setProjectIntakeEditor(null)}>Cancel</button><button className="primary-button" disabled={projectIntakeBusy}>{projectIntakeBusy ? 'Saving…' : 'Save & Download Updated Document'}</button></div>
          </form>
        </div>
      )}

      {manualProjectOpen && !selectedProject && !launchOpen && (
        <div className="project-modal-backdrop" onClick={() => setManualProjectOpen(false)}>
          <section className="manual-project-entry-modal" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setManualProjectOpen(false)}>×</button>
            <header>
              <p className="eyebrow">Manual project setup</p>
              <h2>Add an existing project</h2>
              <p>Connect a live development domain to its real client, owner, and current workflow stage.</p>
            </header>
            <form className="project-entry-form" onSubmit={createManualProject}>
              <label className="full-field">Development domain<select name="domainId" required defaultValue=""><option value="" disabled>Choose a connected domain</option>{projectAwareDomains.filter((domain) => domain.source === 'cpanel' && !projectRecords.some((project) => project.domain === domain.domain)).map((domain) => <option key={domain.id} value={domain.id}>{domain.domain} · {domain.client}</option>)}</select></label>
              <label className="full-field">Client or business name<input name="client" required placeholder="e.g. Clearwater Plumbing" /></label>
              <label>Build type<select name="buildType" defaultValue="Template"><option>Template</option><option>Custom</option></select></label>
              <label>Assigned developer<select name="developer" defaultValue="Barry">{assignableDevelopers.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label>Current stage<select name="stage" defaultValue="Setup">{buildStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
              <label>Stage status<select name="stageStatus" defaultValue="in_progress">{projectStageStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
              <label>Current progress %<input name="progress" type="number" min="0" max="100" defaultValue="0" required /></label>
              <label>Target date<input name="due" placeholder="e.g. 12 Sep" /></label>
              <label className="full-field">Next required action<input name="nextAction" required placeholder="What needs to happen next?" /></label>
              <label className="full-field">Opening progress note<textarea name="note" rows={3} placeholder="Where is the project currently, and is anything blocked?" /></label>
              <div className="manual-project-actions full-field"><button className="text-button" type="button" onClick={() => setManualProjectOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={projectBusy}>{projectBusy ? 'Adding project…' : 'Add project'}</button></div>
            </form>
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
            {launchStep === 2 && <div className="launch-panel"><h3>Select a development domain</h3><p>Choose one of the available, connected WordPress spaces.</p><div className="domain-options">{projectAwareDomains.filter((domain) => domain.status === 'Available').map((domain) => <button className={selectedDomain?.id === domain.id ? 'selected' : ''} key={domain.id} onClick={() => setSelectedDomain(domain)}><span>◎</span><strong>{domain.domain}</strong><small>Available</small></button>)}</div></div>}
            {launchStep === 3 && <div className="launch-panel"><h3>Client intake & assets</h3><p>Add the essentials now. The detailed form can follow inside the project.</p><label>Client or business name<input value={launchClientName} onChange={(event) => setLaunchClientName(event.target.value)} placeholder="e.g. Acme Plumbing" /></label><label>Project notes<textarea value={launchNotes} onChange={(event) => setLaunchNotes(event.target.value)} placeholder="What does the client need?" rows={3} /></label><button className="upload-box" type="button"><span>↑</span><strong>Upload client assets</strong><small>File storage will be connected in the next layer</small></button></div>}
            {notice && <p className="notice success">{notice}</p>}
            <div className="modal-footer"><button className="text-button" onClick={() => launchStep > 1 ? setLaunchStep((step) => step - 1) : setLaunchOpen(false)}>{launchStep > 1 ? 'Back' : 'Cancel'}</button><button className="primary-button" disabled={projectBusy} onClick={() => void continueLaunch()}>{projectBusy ? 'Creating…' : launchStep < 3 ? 'Continue' : 'Create Project'}</button></div>
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

function Dashboard({ domains, onDomain, onLaunch, onMoveToFinalStages, inventoryIsLive, inventoryRefreshing, inventoryLastRefreshedAt }: { domains: Domain[]; onDomain: (domain: Domain) => void; onLaunch: () => void; onMoveToFinalStages: (domain: Domain) => void; inventoryIsLive: boolean; inventoryRefreshing: boolean; inventoryLastRefreshedAt: string | null }) {
  const [draggingDomainId, setDraggingDomainId] = useState<string | number | null>(null);
  const availableCount = domains.filter((domain) => domain.status === 'Available').length;
  const activeCount = domains.filter((domain) => domain.status === 'Busy Working' || domain.status === 'Final Stages').length;
  const finalCount = domains.filter((domain) => domain.status === 'Final Stages').length;
  const refreshTime = inventoryLastRefreshedAt
    ? new Date(inventoryLastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  return (
    <>
      <section className="summary-row" aria-label="Platform summary">
        <div className="summary-card featured"><div><span className="summary-icon">⌁</span><p>Development domains</p><strong>{domains.length}</strong></div><span className="trend">{inventoryIsLive ? 'Live inventory' : 'Demo data'}</span></div>
        <div className="summary-card"><div><span className="summary-icon purple">◇</span><p>Available now</p><strong>{availableCount}</strong></div><span className="trend positive">Ready</span></div>
        <div className="summary-card"><div><span className="summary-icon blue">▣</span><p>Active builds</p><strong>{activeCount}</strong></div><span className="trend">Live domains</span></div>
        <div className="summary-card"><div><span className="summary-icon navy">✓</span><p>Final stages</p><strong>{finalCount}</strong></div><span className="trend positive">On track</span></div>
      </section>
      <section className="board-section">
        <div className="section-heading"><div><p className="eyebrow">Domain board</p><h2>Website workspace</h2></div><div className="board-heading-actions"><span className={`live-refresh-pill ${inventoryRefreshing ? 'refreshing' : ''}`}><i />{inventoryRefreshing ? 'Refreshing live data…' : refreshTime ? `Live · updated ${refreshTime}` : 'Connecting to live data…'}</span><div className="board-tools"><button>All developers⌄</button><button>Filter</button></div></div></div>
        <div className="kanban-board">
          {columns.map((column) => {
            const items = domains.filter((domain) => domain.status === column)
              .sort((left, right) => column === 'Available'
                ? Number(Boolean(left.needsInspection)) - Number(Boolean(right.needsInspection))
                : 0);
            return (
              <div className={`kanban-column ${column === 'Final Stages' && draggingDomainId !== null ? 'drop-ready' : ''}`} key={column}
                onDragOver={(event) => { if (column === 'Final Stages' && draggingDomainId !== null) event.preventDefault(); }}
                onDrop={(event) => {
                  if (column !== 'Final Stages' || draggingDomainId === null) return;
                  event.preventDefault();
                  const domain = domains.find((item) => String(item.id) === String(draggingDomainId));
                  setDraggingDomainId(null);
                  if (domain) void onMoveToFinalStages(domain);
                }}>
                <div className="column-heading"><span className={`status-dot ${column.toLowerCase().replaceAll(' ', '-')}`} /><h3>{column}</h3><span>{items.length}</span></div>
                <div className="column-stack">
                  {items.map((domain) => <DomainCard domain={domain} key={domain.id} onClick={() => onDomain(domain)} draggable={column === 'Busy Working'} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(domain.id)); setDraggingDomainId(domain.id); }} onDragEnd={() => setDraggingDomainId(null)} />)}
                  {column === 'Final Stages' && draggingDomainId !== null && <div className="final-stage-drop-hint">Drop here to move into Final Stages</div>}
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

function DomainCard({ domain, onClick, draggable = false, onDragStart, onDragEnd }: { domain: Domain; onClick: () => void; draggable?: boolean; onDragStart?: (event: DragEvent<HTMLButtonElement>) => void; onDragEnd?: () => void }) {
  return (
    <button className={`domain-card ${draggable ? 'draggable' : ''}`} onClick={onClick} draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="domain-top"><span className="domain-icon">◎</span><span className="more">•••</span></div>
      <strong>{domain.domain}</strong><p>{domain.client}</p>
      {domain.source === 'cpanel' && <div className="domain-control-badges"><span className={domain.softLocked ? '' : 'ready'}>{domain.softLocked ? 'Locked' : 'Unlocked'}</span><span className={domain.connectionMode === 'managed_write' && domain.operationalReady ? 'ready' : ''}>{domain.connectionMode === 'managed_write' && domain.operationalReady ? 'Operational' : domain.operationalReady ? 'Paused' : 'Activate in Settings'}</span></div>}
      {(domain.stage || domain.needsInspection) && <div className="domain-stage-badges">
        {domain.stage && <span className="stage-label">{domain.stage}</span>}
        {domain.needsInspection && <span className="inspection-label">Needs Inspection</span>}
      </div>}
      {domain.source === 'demo' && <div className="progress-track"><span style={{ width: `${Math.max(domain.progress, 6)}%` }} /></div>}
      <div className="domain-meta"><span>{domain.source === 'cpanel' ? domain.wordpress : `${domain.progress}%`}</span>{domain.developer ? <span className={`developer ${domain.developer.toLowerCase().replaceAll(' ', '-')}`}>{domain.developer.slice(0, 1)} · {domain.developer}</span> : <span>Unallocated</span>}</div>
    </button>
  );
}

function DomainsView({ connections, domains, onDomain, onNotice, notice, inventoryIsLive, onCreateSubdomain }: {
  connections: HostingConnection[]; domains: Domain[]; onDomain: (domain: Domain) => void;
  onNotice: (message: string) => void; notice: string; inventoryIsLive: boolean;
  onCreateSubdomain: (input: { connectionId: string; parentDomain: string; subdomainLabel: string }) => Promise<void>;
}) {
  const [subdomainOpen, setSubdomainOpen] = useState(false);
  const [connectionId, setConnectionId] = useState('');
  const [parentDomain, setParentDomain] = useState('');
  const [subdomainLabel, setSubdomainLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const cpanelConnections = connections.filter((connection) => connection.provider === 'cpanel');
  const effectiveConnectionId = connectionId || cpanelConnections[0]?.id || '';
  const selectedConnection = cpanelConnections.find((connection) => connection.id === effectiveConnectionId) ?? null;
  const parentDomains = domains.filter((domain) => domain.source === 'cpanel'
    && domain.connectionId === effectiveConnectionId && (domain.domainType === 'main' || domain.domainType === 'addon'));
  const effectiveParentDomain = parentDomain && parentDomains.some((domain) => domain.domain === parentDomain)
    ? parentDomain : parentDomains[0]?.domain || '';
  const cleanLabel = subdomainLabel.trim().toLowerCase();
  const previewDomain = cleanLabel && effectiveParentDomain ? `${cleanLabel}.${effectiveParentDomain}` : '';
  const availableCount = domains.filter((domain) => domain.status === 'Available').length;
  const templateCount = domains.filter((domain) => domain.status === 'Template Loaded').length;
  const attentionCount = domains.filter((domain) => domain.needsInspection).length;
  return (
    <div className="view-stack">
      <section className="mini-summary-row">
        <div><span>{inventoryIsLive ? 'Connected domains' : 'Demo domains'}</span><strong>{domains.length}</strong><small>{inventoryIsLive ? 'Imported from cPanel' : 'Waiting for connection'}</small></div>
        <div><span>Available</span><strong>{availableCount}</strong><small>Ready for allocation</small></div>
        <div><span>Templates loaded</span><strong>{templateCount}</strong><small>Detected from site names</small></div>
        <div><span>Needs inspection</span><strong>{attentionCount}</strong><small>WordPress data pending</small></div>
      </section>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Connected installations</p><h2>WordPress domain inventory</h2></div><div className="domain-heading-actions"><button className="primary-button" onClick={() => { setCreateError(''); setSubdomainOpen(true); }}>＋ New Subdomain</button><button className="outline-button" onClick={() => onNotice(inventoryIsLive ? 'SpyderWeb scans domains and WordPress installations automatically. Use Sync now in Settings whenever you want an immediate refresh.' : 'Connect cPanel in Settings to replace this demo inventory with live domains.')}>{inventoryIsLive ? 'Scan information' : 'Connection status'}</button></div></div>
        {notice && <p className="notice inline-notice">{notice}</p>}
        <div className="data-table domain-table">
          <div className="table-row table-head"><span>Domain</span><span>Status</span><span>WordPress</span><span>Protection</span><span>Operations</span><span>Host</span><span /></div>
          {domains.map((domain) => (
            <button className="table-row" key={domain.id} onClick={() => onDomain(domain)}>
              <span className="table-primary"><i className="connection-dot" /><span><strong>{domain.domain}</strong><small>{domain.client}</small></span></span>
              <span><b className={`status-pill ${domain.status.toLowerCase().replaceAll(' ', '-')}`}>{domain.status}</b></span>
              <span>{domain.wordpress}</span><span>{domain.softLocked ? 'Soft locked' : 'Unlocked'}</span><span>{domain.connectionMode === 'managed_write' && domain.operationalReady ? 'Ready' : domain.operationalReady ? 'Paused' : 'Reconnect'}</span><span>{domain.host}</span><span className="table-arrow">→</span>
            </button>
          ))}
        </div>
      </section>
      {subdomainOpen && <div className="project-modal-backdrop" onClick={() => !creating && setSubdomainOpen(false)}>
        <form className="new-subdomain-modal" onClick={(event) => event.stopPropagation()} onSubmit={async (event) => {
          event.preventDefault(); setCreateError(''); setCreating(true);
          try {
            await onCreateSubdomain({ connectionId: effectiveConnectionId, parentDomain: effectiveParentDomain, subdomainLabel: cleanLabel });
            setSubdomainLabel(''); setParentDomain(''); setSubdomainOpen(false);
          } catch (error) {
            setCreateError(error instanceof Error ? error.message : 'The subdomain could not be created.');
          } finally { setCreating(false); }
        }}>
          <button className="close-button" type="button" disabled={creating} onClick={() => setSubdomainOpen(false)}>×</button>
          <p className="eyebrow">Domain administration</p><h2>Create a new subdomain</h2>
          <p>Choose the cPanel account and parent domain. SpyderWeb will create the address in cPanel, verify it, and add it to the Available column.</p>
          <div className="new-subdomain-fields">
            <label>cPanel account<select required value={effectiveConnectionId} onChange={(event) => { setConnectionId(event.target.value); setParentDomain(''); setCreateError(''); }}><option value="" disabled>Choose cPanel</option>{cpanelConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}{connection.mode === 'managed_write' ? '' : ' · operations paused'}</option>)}</select></label>
            <label>Parent domain<select required value={effectiveParentDomain} onChange={(event) => setParentDomain(event.target.value)}><option value="" disabled>Choose parent domain</option>{parentDomains.map((domain) => <option key={domain.id} value={domain.domain}>{domain.domain}</option>)}</select></label>
            <label className="full-field">Subdomain name<div className="subdomain-address-input"><input required value={subdomainLabel} onChange={(event) => setSubdomainLabel(event.target.value.toLowerCase())} pattern="[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?" placeholder="client-name" /><span>.{effectiveParentDomain || 'parent-domain.com'}</span></div><small>Use letters, numbers and hyphens. This creates the domain only; WordPress can be installed afterwards.</small></label>
          </div>
          {previewDomain && <div className="subdomain-preview"><span>New address</span><strong>{previewDomain}</strong><small>It will appear as Available after cPanel verification.</small></div>}
          {selectedConnection?.mode !== 'managed_write' && <p className="notice">Resume operations for {selectedConnection?.name} in Settings before creating this subdomain.</p>}
          {!parentDomains.length && <p className="notice">No main or add-on parent domain was found for this cPanel account. Scan it again in Settings.</p>}
          {createError && <p className="notice error-notice">{createError}</p>}
          <div className="operation-confirm-actions"><button className="text-button" type="button" disabled={creating} onClick={() => setSubdomainOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={creating || !cleanLabel || !effectiveParentDomain || selectedConnection?.mode !== 'managed_write'}>{creating ? 'Creating & verifying…' : 'Create Subdomain'}</button></div>
        </form>
      </div>}
    </div>
  );
}

const intakeChoiceFields: Array<{ key: keyof ClientIntake; label: string }> = [
  { key: 'clientFolderCreated', label: 'Client folder created' },
  { key: 'logoReady', label: 'Logo resized and ready' },
  { key: 'imageAssetExamples', label: 'Image generation examples available' },
  { key: 'clientImagesAvailable', label: 'Client images available' },
  { key: 'aiImagesPermitted', label: 'AI images permitted' },
  { key: 'stockImagesPermitted', label: 'Free stock images permitted' },
];

function RepeatableIntakeField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <fieldset className="repeatable-intake-field"><legend>{label}</legend>{values.map((value, index) => <div key={`${label}-${index}`}><input value={value} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><button type="button" aria-label={`Remove ${label} item`} disabled={values.length === 1} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}<button type="button" className="add-intake-field" onClick={() => onChange([...values, ''])}>＋ Add another</button></fieldset>;
}

function ClientIntakeForm({ projectName, intake, onChange, expanded = false }: { projectName: string; intake: ClientIntake; onChange: (update: (current: ClientIntake) => ClientIntake) => void; expanded?: boolean }) {
  const update = (key: keyof ClientIntake, value: string | string[]) => onChange((current) => ({ ...current, [key]: value }));
  const textFields: Array<{ key: keyof ClientIntake; label: string; type?: string }> = [
    { key: 'industry', label: 'Industry' }, { key: 'primaryRegion', label: 'Primary location or region' },
    { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'email', label: 'Email', type: 'email' },
    { key: 'whatsapp', label: 'WhatsApp', type: 'tel' }, { key: 'contactFormEmail', label: 'Contact form recipient email', type: 'email' },
    { key: 'businessAddress', label: 'Business address' }, { key: 'existingWebsite', label: 'Existing website for context only', type: 'url' },
    { key: 'homePageH1', label: 'H1 for the Home Page' }, { key: 'focusKeyphrase', label: 'Focus key phrase for the Home Page' },
    { key: 'colorsToAvoid', label: 'Colours or styles to avoid' },
  ];
  const finalIntake = { ...intake, clientName: projectName };
  return <details className="client-intake-details" open={expanded || undefined}>
    <summary><span><b>Submit Project Details</b><small>Client information for the website build and AI handover</small></span><i>⌄</i></summary>
    <div className="client-intake-body">
      <input type="hidden" name="intakeJson" value={JSON.stringify(finalIntake)} />
      <section><h3>Client and contact details</h3><div className="intake-fields-grid">{textFields.slice(0, 8).map((field) => <label key={field.key}>{field.label}<input type={field.type || 'text'} value={String(intake[field.key])} onChange={(event) => update(field.key, event.target.value)} /></label>)}</div><p className="intake-reference-note">The existing website is used only for context and content reference. Its images and other assets must not be reused.</p></section>
      <section><h3>Reference links</h3><div className="intake-repeat-grid"><RepeatableIntakeField label="Google Business Profile links" values={intake.googleBusinessProfiles} onChange={(values) => update('googleBusinessProfiles', values)} /><RepeatableIntakeField label="Facebook and social accounts" values={intake.socialAccounts} onChange={(values) => update('socialAccounts', values)} /></div></section>
      <section><h3>Asset readiness and permissions</h3><div className="intake-choice-grid">{intakeChoiceFields.map((field) => <label key={field.key}>{field.label}<select value={String(intake[field.key])} onChange={(event) => update(field.key, event.target.value)}><option value="">Choose</option><option>Yes</option><option>No</option><option>Not applicable</option></select></label>)}</div></section>
      <section><h3>Home page and services</h3><div className="intake-fields-grid">{textFields.slice(8, 10).map((field) => <label key={field.key}>{field.label}<input value={String(intake[field.key])} onChange={(event) => update(field.key, event.target.value)} /></label>)}</div><div className="intake-repeat-grid"><RepeatableIntakeField label="Primary services for the Home Page" values={intake.primaryServices} onChange={(values) => update('primaryServices', values)} /><RepeatableIntakeField label="Additional services for the Services Page" values={intake.additionalServices} onChange={(values) => update('additionalServices', values)} /><RepeatableIntakeField label="Additional locations" values={intake.additionalLocations} onChange={(values) => update('additionalLocations', values)} /><RepeatableIntakeField label="Trust facts" values={intake.trustFacts} onChange={(values) => update('trustFacts', values)} /></div></section>
      <section><h3>Content and brand direction</h3><div className="intake-textarea-grid"><label>Additional information<textarea rows={4} value={intake.additionalInformation} onChange={(event) => update('additionalInformation', event.target.value)} /></label><label>Brand guidelines<textarea rows={4} value={intake.brandGuidelines} onChange={(event) => update('brandGuidelines', event.target.value)} /></label><label>Content style<textarea rows={4} value={intake.contentStyle} onChange={(event) => update('contentStyle', event.target.value)} /></label><label>Colours or styles to avoid<textarea rows={4} value={intake.colorsToAvoid} onChange={(event) => update('colorsToAvoid', event.target.value)} /></label></div></section>
    </div>
  </details>;
}

function TemplatePreviewCard({ slot, domains, onSave }: { slot: TemplateSlot; domains: Domain[]; onSave: (slotNumber: number, name: string, sourceDomainId: string | null) => Promise<void> }) {
  const [name, setName] = useState(slot.name);
  const [sourceDomainId, setSourceDomainId] = useState(slot.sourceDomainId ?? '');
  const [saving, setSaving] = useState(false);
  const eligible = domains.filter((domain) => domain.source === 'cpanel' && domain.wordpress.startsWith('Installed'));
  return <article className="template-preview-card">
    <div className="template-preview-frame">
      {slot.previewUrl ? <iframe src={slot.previewUrl} title={`${slot.name} preview`} loading="lazy" sandbox="allow-scripts allow-same-origin" /> : <div><span>◇</span><strong>Choose a template domain</strong><small>A live preview will appear here.</small></div>}
    </div>
    <div className="template-preview-fields">
      <label>Template name<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
      <label>Source domain<select value={sourceDomainId} onChange={(event) => setSourceDomainId(event.target.value)}><option value="">Not configured</option>{eligible.map((domain) => <option key={domain.id} value={String(domain.id)}>{domain.domain}</option>)}</select></label>
      <button className="outline-button" disabled={saving || !name.trim()} onClick={async () => { setSaving(true); try { await onSave(slot.slotNumber, name, sourceDomainId || null); } finally { setSaving(false); } }}>{saving ? 'Saving…' : 'Save template'}</button>
    </div>
  </article>;
}

const launchProjectDraftKey = 'spyderweb:new-project-draft:v1';

type LaunchProjectDraft = {
  projectName: string;
  connectionId: string;
  subdomain: string;
  targetMode: 'existing' | 'new';
  selectedExistingDomainId: string;
  templateDecision: 'keep' | 'replace';
  selectedTemplateSlotNumber: string;
  parentDomain: string;
  developer: Developer;
  confirmExistingOverwrite: boolean;
  notes: string;
  intake: ClientIntake;
};

function LaunchProjectView({ connections, domains, templates, busy, onSaveTemplate, onLaunch, onActivateWordPress }: {
  connections: HostingConnection[]; domains: Domain[]; templates: TemplateSlot[]; busy: boolean;
  onSaveTemplate: (slotNumber: number, name: string, sourceDomainId: string | null) => Promise<void>;
  onLaunch: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onActivateWordPress: (connection: HostingConnection) => void;
}) {
  const connected = connections.filter((connection) => connection.mode === 'managed_write');
  const [connectionId, setConnectionId] = useState(connected[0]?.id ?? '');
  const [projectName, setProjectName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('existing');
  const [selectedExistingDomainId, setSelectedExistingDomainId] = useState('');
  const [templateDecision, setTemplateDecision] = useState<'keep' | 'replace'>('replace');
  const [selectedTemplateSlotNumber, setSelectedTemplateSlotNumber] = useState('');
  const [parentDomain, setParentDomain] = useState('');
  const [developer, setDeveloper] = useState<Developer>('Owner Account');
  const [confirmExistingOverwrite, setConfirmExistingOverwrite] = useState(false);
  const [notes, setNotes] = useState('');
  const [intake, setIntake] = useState<ClientIntake>(emptyClientIntake);
  const [draftReady, setDraftReady] = useState(false);
  const effectiveConnectionId = connectionId || connected[0]?.id || '';
  const selectedConnection = connected.find((connection) => connection.id === effectiveConnectionId) ?? null;
  const managementReady = selectedConnection?.operationalCredentialStatus === 'verified';
  const parents = domains.filter((domain) => domain.connectionId === effectiveConnectionId && (domain.domainType === 'main' || domain.domainType === 'addon'));
  const compatibleTemplates = templates.filter((template) => template.connectionId === effectiveConnectionId && template.sourceDomainId);
  const templateDomainIds = new Set(templates.map((template) => String(template.sourceDomainId)).filter(Boolean));
  const existingTargets = domains.filter((domain) => isSelectableExistingDomain(domain, templateDomainIds));
  const selectedExistingDomain = existingTargets.find((domain) => String(domain.id) === selectedExistingDomainId) ?? null;
  const canKeepLoadedTemplate = targetMode === 'existing' && selectedExistingDomain?.status === 'Template Loaded';
  const keepingLoadedTemplate = canKeepLoadedTemplate && templateDecision === 'keep';
  const requiresTemplateOperation = !keepingLoadedTemplate;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(launchProjectDraftKey);
        if (saved) {
          const draft = JSON.parse(saved) as Partial<LaunchProjectDraft>;
          if (typeof draft.projectName === 'string') setProjectName(draft.projectName);
          if (typeof draft.connectionId === 'string') setConnectionId(draft.connectionId);
          if (typeof draft.subdomain === 'string') setSubdomain(draft.subdomain);
          if (draft.targetMode === 'existing' || draft.targetMode === 'new') setTargetMode(draft.targetMode);
          if (typeof draft.selectedExistingDomainId === 'string') setSelectedExistingDomainId(draft.selectedExistingDomainId);
          if (draft.templateDecision === 'keep' || draft.templateDecision === 'replace') setTemplateDecision(draft.templateDecision);
          if (typeof draft.selectedTemplateSlotNumber === 'string') setSelectedTemplateSlotNumber(draft.selectedTemplateSlotNumber);
          if (typeof draft.parentDomain === 'string') setParentDomain(draft.parentDomain);
          if (assignableDevelopers.includes(draft.developer as Developer)) setDeveloper(draft.developer as Developer);
          if (typeof draft.confirmExistingOverwrite === 'boolean') setConfirmExistingOverwrite(draft.confirmExistingOverwrite);
          if (typeof draft.notes === 'string') setNotes(draft.notes);
          if (draft.intake && typeof draft.intake === 'object') setIntake({ ...emptyClientIntake, ...draft.intake });
        }
      } catch {
        window.localStorage.removeItem(launchProjectDraftKey);
      } finally {
        setDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const draft: LaunchProjectDraft = { projectName, connectionId: effectiveConnectionId, subdomain, targetMode, selectedExistingDomainId,
      templateDecision, selectedTemplateSlotNumber, parentDomain, developer, confirmExistingOverwrite, notes, intake };
    window.localStorage.setItem(launchProjectDraftKey, JSON.stringify(draft));
  }, [confirmExistingOverwrite, developer, draftReady, effectiveConnectionId, intake, notes, parentDomain, projectName, selectedExistingDomainId, selectedTemplateSlotNumber, subdomain, targetMode, templateDecision]);

  return <div className="view-stack launch-project-view">
    <section className="panel new-project-panel">
      <div className="section-heading"><div><p className="eyebrow">Create and deploy</p><h2>Launch a new project</h2><p>Install WordPress on the chosen development domain, apply the selected template, save the project, and prepare the manual handover document.</p></div><span className="root-install-pill">Root install · no /wp folder</span></div>
      <form className="new-project-form" onSubmit={(event) => { void (async () => { const launched = await onLaunch(event); if (launched) window.localStorage.removeItem(launchProjectDraftKey); })(); }}>
        <label>Project name<input name="projectName" required value={projectName} onChange={(event) => { const value = event.target.value; setProjectName(value); setSubdomain((current) => current && current !== suggestedSubdomainLabel(projectName) ? current : suggestedSubdomainLabel(value)); }} placeholder="Jamie's Plumbing" /></label>
        <label>cPanel account<select name="connectionId" required value={effectiveConnectionId} onChange={(event) => { setConnectionId(event.target.value); setSelectedExistingDomainId(''); setTemplateDecision('replace'); setSelectedTemplateSlotNumber(''); }}><option value="" disabled>Choose cPanel</option>{connected.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}{connection.operationalCredentialStatus === 'verified' ? '' : ' · activation needed'}</option>)}</select></label>
        <fieldset className="launch-target-switch"><legend>Website address</legend><div>
          <label className={targetMode === 'existing' ? 'active' : ''}><input type="radio" name="targetMode" value="existing" checked={targetMode === 'existing'} onChange={() => setTargetMode('existing')} /><span>Existing domain</span></label>
          <label className={targetMode === 'new' ? 'active' : ''}><input type="radio" name="targetMode" value="new" checked={targetMode === 'new'} onChange={() => { setTargetMode('new'); setTemplateDecision('replace'); }} /><span>Create new</span></label>
        </div></fieldset>
        {targetMode === 'existing' ? <label className="launch-existing-domain">Existing development domain<select name="existingDomainId" required value={selectedExistingDomainId} onChange={(event) => { const domainId = event.target.value; setSelectedExistingDomainId(domainId); const domain = existingTargets.find((item) => String(item.id) === domainId); setTemplateDecision(domain?.status === 'Template Loaded' ? 'keep' : 'replace'); setSelectedTemplateSlotNumber(''); if (domain?.connectionId) setConnectionId(domain.connectionId); }}><option value="" disabled>Choose an available or template-loaded domain</option>{connected.map((connection) => {
          const connectionDomains = existingTargets.filter((domain) => domain.connectionId === connection.id);
          return connectionDomains.length ? <optgroup key={connection.id} label={connection.name}>{connectionDomains.map((domain) => <option key={domain.id} value={String(domain.id)}>{domain.domain}{domain.status === 'Template Loaded' ? ` · Template loaded: ${domain.template}` : domain.wordpress === 'Not installed' ? ' · No WordPress' : ' · Available WordPress'}{domain.softLocked ? ' · Soft locked' : ''}</option>)}</optgroup> : null;
        })}</select><small>Dashboard domains marked Available or Template Loaded are listed here. Choosing one automatically selects its cPanel account.</small></label> : <>
          <label>Parent domain<select name="parentDomain" required value={parentDomain} onChange={(event) => setParentDomain(event.target.value)}><option value="" disabled>Choose parent domain</option>{parents.map((domain) => <option key={domain.id} value={domain.domain}>{domain.domain}</option>)}</select></label>
          <label>New subdomain<input name="subdomainLabel" required value={subdomain} onChange={(event) => setSubdomain(event.target.value.toLowerCase())} pattern="[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?" placeholder="jamies-plumbing" /><small>The WordPress address will be the domain root, never /wp.</small></label>
        </>}
        {canKeepLoadedTemplate && <fieldset className="loaded-template-choice full-field"><legend>Template already loaded</legend><div className="loaded-template-summary"><span>✓</span><p><strong>{selectedExistingDomain?.template}</strong><small>{selectedExistingDomain?.domain} already has this template. Is it the right one for the new project?</small></p></div><div className="loaded-template-options"><label className={templateDecision === 'keep' ? 'active' : ''}><input type="radio" name="templateDecision" value="keep" checked={templateDecision === 'keep'} onChange={() => setTemplateDecision('keep')} /><span><strong>Yes, use this template</strong><small>Keep WordPress exactly as it is.</small></span></label><label className={templateDecision === 'replace' ? 'active' : ''}><input type="radio" name="templateDecision" value="replace" checked={templateDecision === 'replace'} onChange={() => setTemplateDecision('replace')} /><span><strong>No, replace it</strong><small>Delete it and load another template.</small></span></label></div></fieldset>}
        {!canKeepLoadedTemplate && <input type="hidden" name="templateDecision" value="replace" />}
        {requiresTemplateOperation && <label>Template<select name="templateSlotNumber" required value={selectedTemplateSlotNumber} onChange={(event) => setSelectedTemplateSlotNumber(event.target.value)}><option value="" disabled>Choose template</option>{compatibleTemplates.map((template) => <option key={template.id} value={template.slotNumber}>{template.name} · {template.sourceDomain}</option>)}</select></label>}
        <label>Assign to<select name="developer" value={developer} onChange={(event) => setDeveloper(event.target.value as Developer)}>{assignableDevelopers.map((name) => <option key={name}>{name}</option>)}</select></label>
        {targetMode === 'existing' && requiresTemplateOperation && <label className="launch-overwrite-confirm"><input type="checkbox" name="confirmExistingOverwrite" value="true" required checked={confirmExistingOverwrite} onChange={(event) => setConfirmExistingOverwrite(event.target.checked)} /><span><strong>Confirm template replacement</strong><small>This deletes any WordPress installation on the selected domain before loading the template.</small></span></label>}
        <label className="full-field">Project notes<textarea name="notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional client brief or launch notes" /></label>
        <div className="full-field"><ClientIntakeForm projectName={projectName} intake={intake} onChange={setIntake} /></div>
        {selectedConnection && !managementReady && requiresTemplateOperation && <div className="launch-readiness-warning full-field"><span>WordPress Management needs the cPanel account password once before this account can install or replace a template.</span><button type="button" className="outline-button" onClick={() => onActivateWordPress(selectedConnection)}>Activate here</button></div>}
        <div className="launch-summary full-field"><span>1</span><p><strong>{targetMode === 'existing' ? keepingLoadedTemplate ? 'Keep the verified template' : 'Prepare the selected domain' : 'Create the new subdomain'}</strong><small>{targetMode === 'existing' ? keepingLoadedTemplate ? 'The existing WordPress installation is not deleted or changed.' : 'Any existing WordPress installation is removed only after confirmation.' : 'The launch stops if the address already exists.'}</small></p><span>2</span><p><strong>{keepingLoadedTemplate ? 'Create and assign the project' : 'Install WordPress and apply the selected template'}</strong><small>{keepingLoadedTemplate ? 'The loaded template becomes the starting point for the new project.' : 'Softaculous clones the chosen template directly to the domain root.'}</small></p><span>3</span><p><strong>Save, track and download</strong><small>The project is added to the pipeline and its Word details download for manual agent handover.</small></p></div>
        <div className="launch-draft-status full-field"><span>Draft saved automatically on this device</span><button type="button" className="text-button" onClick={() => { window.localStorage.removeItem(launchProjectDraftKey); setProjectName(''); setSubdomain(''); setSelectedExistingDomainId(''); setTemplateDecision('replace'); setSelectedTemplateSlotNumber(''); setParentDomain(''); setDeveloper('Owner Account'); setConfirmExistingOverwrite(false); setNotes(''); setIntake(emptyClientIntake); }}>Clear draft</button></div>
        <button className="primary-button launch-project-submit full-field" disabled={busy || (requiresTemplateOperation && (!managementReady || !compatibleTemplates.length || !selectedTemplateSlotNumber)) || (targetMode === 'existing' && !selectedExistingDomainId)}>{busy ? keepingLoadedTemplate ? 'Saving project & preparing document…' : 'Installing WordPress & applying template…' : 'Launch Project & Download Details'}</button>
      </form>
    </section>
    <section className="panel template-library-panel">
      <div className="section-heading"><div><p className="eyebrow">Template selection and setup</p><h2>Four launch-ready templates</h2><p>Edit the display name and connect each window to its live template domain.</p></div><span className="manual-mode-pill">4 template spaces</span></div>
      <div className="template-preview-grid">{templates.map((slot) => <TemplatePreviewCard key={`${slot.id}:${slot.updatedAt ?? slot.name}:${slot.sourceDomainId ?? ''}`} slot={slot} domains={domains} onSave={onSaveTemplate} />)}</div>
    </section>
  </div>;
}

function projectActivityClass(project: Project) {
  const timestamp = new Date(project.latestActivityAt || project.updatedAt).getTime();
  const ageDays = Number.isFinite(timestamp) ? (Date.now() - timestamp) / 86_400_000 : 99;
  return ageDays > 14 ? 'activity-stale' : ageDays > 7 ? 'activity-watch' : 'activity-current';
}

function relativeActivity(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

function ProjectsView({ domains, projects, activityRefreshing, activityCheckedAt, onRefreshActivity, onProject, onManageDomains, onReorder }: { domains: Domain[]; projects: Project[]; activityRefreshing: boolean; activityCheckedAt: string | null; onRefreshActivity: () => void; onProject: (project: Project) => void; onManageDomains: () => void; onReorder: (projectIds: string[]) => Promise<void> }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const operationalDomains = domains.filter((domain) => domain.connectionMode === 'managed_write' && domain.operationalReady).length;
  const lockedDomains = domains.filter((domain) => domain.softLocked).length;
  const barryProjects = projects.filter((project) => project.developer === 'Barry').length;
  const cliveProjects = projects.filter((project) => project.developer === 'Clive').length;
  const templateProjects = projects.filter((project) => project.buildType === 'Template').length;
  const customProjects = projects.filter((project) => project.buildType === 'Custom').length;
  return (
    <div className="view-stack">
      <section className="hosting-project-strip">
        <div><p className="eyebrow">Hosting workspace</p><h2>{operationalDomains} operational domain{operationalDomains === 1 ? '' : 's'}</h2><span>{lockedDomains} currently protected by soft lock</span></div>
        <p>Project stages remain separate from cPanel. Use Domain Management for WordPress, template, restore-point and PHP actions.</p>
        <button className="outline-button" onClick={onManageDomains}>Open Domain Management</button>
      </section>
      <section className="project-overview-strip">
        <div><span className="large-number">{projects.length}</span><span><strong>Tracked projects</strong><small>{templateProjects} template · {customProjects} custom</small></span></div>
        <div className="agent-load"><span><b>Barry</b><small>{barryProjects} project{barryProjects === 1 ? '' : 's'}</small></span><div><i style={{ width: `${Math.min(barryProjects * 20, 100)}%` }} /></div></div>
        <div className="agent-load purple-load"><span><b>Clive</b><small>{cliveProjects} project{cliveProjects === 1 ? '' : 's'}</small></span><div><i style={{ width: `${Math.min(cliveProjects * 20, 100)}%` }} /></div></div>
      </section>
      <section className="panel project-board-panel">
        <div className="section-heading"><div><p className="eyebrow">Current work</p><h2>Manual project pipeline</h2></div><div className="board-heading-actions"><span className="manual-mode-pill">Manual stages</span><span className="auto-project-pill">WordPress activity monitored</span><button className="outline-button compact-button" disabled={activityRefreshing} onClick={onRefreshActivity}>{activityRefreshing ? 'Checking…' : 'Refresh activity'}</button>{activityCheckedAt && <small className="activity-checked-time">Checked {new Date(activityCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}</div></div>
        <div className="project-card-row">
          {projects.map((project) => (
            <article className={`project-board-card ${projectActivityClass(project)} ${draggingId === project.id ? 'dragging' : ''}`} key={project.id} draggable
              onDragStart={(event) => { setDraggingId(project.id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDraggingId(null)}
              onDragOver={(event) => { if (draggingId && draggingId !== project.id) event.preventDefault(); }}
              onDrop={(event) => { event.preventDefault(); if (!draggingId || draggingId === project.id) return; const ids = projects.map((item) => item.id); const from = ids.indexOf(draggingId); const to = ids.indexOf(project.id); ids.splice(to, 0, ids.splice(from, 1)[0]); setDraggingId(null); void onReorder(ids); }}>
              <button className="project-card-open" onClick={() => onProject(project)}>
                <div className="project-card-top"><span className={`project-avatar small ${project.developer.toLowerCase()}`}>{project.client.slice(0, 1)}</span><span><b>{project.stage}</b><small>{project.stageStatus.replaceAll('_', ' ')}</small></span><i title="Drag to arrange">⋮⋮</i></div>
                <h3>{project.client}</h3><p>{project.domain}</p>
                <div className="project-card-meta"><span><small>Started</small><strong>{new Date(project.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span><span><small>Assigned</small><strong>{project.developer}</strong></span></div>
                <div className="project-progress"><b>{project.progress}%</b><span className="progress-track"><i style={{ width: `${project.progress}%` }} /></span></div>
                <footer title={new Date(project.latestActivityAt).toLocaleString()}><span className="activity-indicator" /><span>{project.latestActivitySource === 'wordpress' ? 'WordPress changed' : 'Project updated'} {relativeActivity(project.latestActivityAt || project.updatedAt)}</span><b>Open →</b></footer>
              </button>
            </article>
          ))}
          {projects.length === 0 && <div className="empty-project-state"><span>◇</span><div><strong>Connecting project records…</strong><p>Every connected domain is added here automatically. Project stages remain manual and do not change WordPress.</p></div></div>}
        </div>
      </section>
    </div>
  );
}

function AgentActivity({ auditEvents, projects, projectEvents, filter, onFilter }: { auditEvents: AuditEvent[]; projects: Project[]; projectEvents: ProjectEvent[]; filter: 'All' | Developer; onFilter: (filter: 'All' | Developer) => void }) {
  const visibleActivities = projectEvents.filter((activity) => filter === 'All' || activity.developer === filter);
  const barryProjects = projects.filter((project) => project.developer === 'Barry');
  const cliveProjects = projects.filter((project) => project.developer === 'Clive');
  return (
    <div className="agent-layout">
      <section className="agent-column">
        <div className="agent-card">
          <div className="agent-card-top"><span className="avatar barry">B</span><span><strong>Barry</strong><small>Template website builder</small></span><b className="online-pill">Manual</b></div>
          <p>{barryProjects.length ? `${barryProjects.length} project${barryProjects.length === 1 ? '' : 's'} currently assigned.` : 'No manually tracked projects assigned.'}</p>
          <div className="agent-stats"><span><small>Assigned</small><strong>{barryProjects.length}</strong></span><span><small>In review</small><strong>{barryProjects.filter((project) => project.stageStatus === 'awaiting_review').length}</strong></span><span><small>Blocked</small><strong>{barryProjects.filter((project) => project.stageStatus === 'blocked').length}</strong></span></div>
        </div>
        <div className="agent-card">
          <div className="agent-card-top"><span className="avatar clive">C</span><span><strong>Clive</strong><small>Custom website builder</small></span><b className="online-pill purple">Manual</b></div>
          <p>{cliveProjects.length ? `${cliveProjects.length} project${cliveProjects.length === 1 ? '' : 's'} currently assigned.` : 'No manually tracked projects assigned.'}</p>
          <div className="agent-stats"><span><small>Assigned</small><strong>{cliveProjects.length}</strong></span><span><small>In review</small><strong>{cliveProjects.filter((project) => project.stageStatus === 'awaiting_review').length}</strong></span><span><small>Blocked</small><strong>{cliveProjects.filter((project) => project.stageStatus === 'blocked').length}</strong></span></div>
        </div>
        <div className="connection-card"><span className="connection-symbol">⌁</span><div><strong>Codex reporting link</strong><p>Manual workflow is active. Barry and Clive communication comes next.</p></div><b>Not connected</b></div>
      </section>
      <section className="panel activity-panel">
        <div className="section-heading"><div><p className="eyebrow">Latest reports</p><h2>Activity timeline</h2></div><div className="filter-tabs">{(['All', 'Barry', 'Clive'] as const).map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => onFilter(item)}>{item}</button>)}</div></div>
        <div className="timeline">
          {visibleActivities.map((activity) => (
            <div className="timeline-item" key={activity.id}>
              <span className={`timeline-dot ${activity.developer.toLowerCase()}`} />
              <span className="timeline-time">{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="timeline-copy"><strong>{activity.project}</strong><p><b>{activity.source}</b> · {activity.note || activity.eventType.replaceAll('.', ' ')}</p></span>
              <b className="activity-status">{activity.stageStatus?.replaceAll('_', ' ') || 'Updated'}</b>
            </div>
          ))}
          {visibleActivities.length === 0 && <p className="empty-activity">No manual project updates have been recorded for this filter.</p>}
        </div>
        <div className="hosting-audit-heading"><div><p className="eyebrow">Hosting operations</p><h3>Protected action history</h3></div><span>{auditEvents.length ? 'Live audit' : 'No actions yet'}</span></div>
        <div className="hosting-audit-list">
          {auditEvents.slice(0, 8).map((event) => (
            <div key={event.id}><span className={`audit-outcome ${event.outcome}`}>{event.outcome}</span><span><strong>{event.action.replaceAll('.', ' · ')}</strong><small>{event.target || 'SpyderWeb'} · {new Date(event.createdAt).toLocaleString()}</small></span></div>
          ))}
          {!auditEvents.length && <p>No cPanel or WordPress actions have been recorded for this owner account.</p>}
        </div>
      </section>
    </div>
  );
}

function SettingsView({ connections, syncingId, modeChangingId, notice, onSync, onModeChange, onActivateWordPress, onConnect }: { connections: HostingConnection[]; syncingId: string | null; modeChangingId: string | null; notice: string; onSync: (connectionId: string) => void; onModeChange: (connection: HostingConnection) => void; onActivateWordPress: (connection: HostingConnection) => void; onConnect: (provider: HostingProvider) => void }) {
  const cpanelConnections = connections.filter((connection) => connection.provider === 'cpanel');
  const managedConnections = cpanelConnections.filter((connection) => connection.mode === 'managed_write' && connection.operationalCredentialStatus === 'verified');
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
        <div className="section-heading"><div><p className="eyebrow">Hosting accounts</p><h2>Connect your development hosting</h2><p>Domain inventory and live WordPress operations are managed here. Project reporting remains completely separate.</p></div><span className={`connection-count ${connections.length ? 'connected' : ''}`}>{connections.length} connected</span></div>
        <div className="hosting-provider-grid">
          <article className="hosting-provider-card">
            <div className="provider-card-top"><span className="provider-logo cpanel">cP</span><span className={`not-connected ${cpanelConnections.length ? 'connected' : ''}`}>{cpanelConnections.length ? `${cpanelConnections.length} connected` : 'Not connected'}</span></div>
            <h3>cPanel</h3><p>Connect the shared hosting account that manages your main development domain and WordPress subdomains.</p>
            <ul><li>Discover and save live domains</li><li>Manage domains and PHP with the API token</li><li>Activate Softaculous WordPress controls once</li></ul>
            {cpanelConnections.length > 0 && <div className="saved-connections">{cpanelConnections.map((connection) => (
              <article className="operational-connection" key={connection.id}>
                <div className="connection-summary">
                  <div className="connection-details"><span><strong>{connection.name}</strong><b className={`connection-health-pill ${connection.status === 'connected_scan_issue' ? 'warning' : ''}`}>{connection.status === 'connected_scan_issue' ? 'Connected · scan needed' : 'cPanel connected'}</b><b className={`operational-pill ${connection.operationalCredentialStatus === 'verified' ? 'verified' : ''}`}>{connection.operationalCredentialStatus === 'verified' ? 'WordPress Management active' : 'WordPress Management not active'}</b>{connection.operationalCredentialStatus === 'verified' && <b className={`access-mode-pill ${connection.mode === 'managed_write' ? 'managed' : ''}`}>{connection.mode === 'managed_write' ? 'Operations active' : 'Operations paused'}</b>}</span><small>{connection.baseUrl}</small><small>{connection.status === 'connected_scan_issue' ? 'cPanel authentication verified · live inventory scan needs attention' : `Last scan: ${new Date(connection.lastSyncAt).toLocaleString()}`}</small></div>
                  <div className="connection-controls">
                    <button className="outline-button" disabled={syncingId === connection.id || modeChangingId === connection.id} onClick={() => onSync(connection.id)}>{syncingId === connection.id ? 'Scanning…' : connection.status === 'connected_scan_issue' ? 'Retry scan' : 'Scan domains & WordPress'}</button>
                    {connection.operationalCredentialStatus !== 'verified' && <button className="primary-button" onClick={() => onActivateWordPress(connection)}>Activate WordPress Management</button>}
                    {connection.operationalCredentialStatus === 'verified' && <button className={`access-mode-button ${connection.mode === 'managed_write' ? 'read-only' : ''}`} disabled={syncingId === connection.id || modeChangingId === connection.id} onClick={() => onModeChange(connection)}>{modeChangingId === connection.id ? 'Changing…' : connection.mode === 'managed_write' ? 'Pause WordPress operations' : 'Resume WordPress operations'}</button>}
                  </div>
                </div>
                <div id={`operations-${connection.id}`} className="operational-form">
                  <div className="operational-form-heading"><div><p className="eyebrow">WordPress operations</p><h4>{connection.operationalCredentialStatus !== 'verified' ? 'Activation required' : connection.mode === 'managed_write' ? 'WordPress Management active' : 'WordPress Management paused'}</h4></div><span>{connection.defaultTemplateDomain || 'Template will be selected during activation'}</span></div>
                  <p>{connection.operationalCredentialStatus === 'verified' ? 'Softaculous access is encrypted and saved. Fresh installations use temporary admin / admin credentials because the template immediately replaces them.' : 'The cPanel connection is already working for domains and PHP. Activate WordPress Management once to add Softaculous install, delete and template-clone access.'}</p>
                </div>
              </article>
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
          <span><b>1</b><strong>Soft lock</strong><small>A locked domain cannot have WordPress deleted or overwritten with a template.</small></span>
          <span><b>2</b><strong>Clear confirmation</strong><small>Deletion asks “Are you sure?” before it runs.</small></span>
          <span><b>3</b><strong>Overwrite warning</strong><small>Template loading clearly warns when it will replace an existing website.</small></span>
        </div>
        <strong className={`hard-lock ${managedConnections.length ? 'managed' : ''}`}>{managedConnections.length ? `${managedConnections.length} connection${managedConnections.length === 1 ? '' : 's'} operational · per-domain locks remain active` : 'WordPress operations are not active yet'}</strong>
      </section>

      <section className="settings-note"><span>⌁</span><div><strong>Multiple hosting spaces supported</strong><p>Add every authorised cPanel account here. Each connection remains saved and can be synchronised independently; Hostinger accounts will use the same model when that connector is added.</p></div></section>
    </div>
  );
}
