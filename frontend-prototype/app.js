/* Drenyra Command Center prototype. Mock-only UI; native contracts own mutations. */

import { createState, repository } from './data.js';
import { DOM } from './dom.js';

const state = createState();
const route = { section: 'home', params: new URLSearchParams() };

function formatCents(cents) {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `S/ ${whole.toLocaleString('es-PE')}.${fraction}`;
}

function formatDate() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date('2026-07-14T12:00:00-05:00'));
}

function missionMatchesFilter(mission, filter) {
  if (filter === 'attention') return mission.status === 'attention';
  if (filter === 'completed') return mission.status === 'completed';
  return mission.status !== 'completed';
}

function formatTemplate(value) {
  return value.replaceAll('{difference}', formatCents(repository.finding.sireIgvCents - repository.finding.expectedIgvCents));
}

const App = {
  init() {
    this.renderAll();
    this.bindNavigation();
    this.bindMissionControls();
    this.bindInspector();
    this.bindComposer();
    this.bindGlobalChat();
    this.bindCommands();
    this.bindRefresh();
    this.bindMissionCreation();
    this.bindReview();
    this.bindGlobalKeyboard();
    this.bindTheme();
    this.bindResize();
    this.bindWorkspaceTabs();
    this.openFromHash();
  },

  renderAll() {
    DOM.query('#briefing-date').textContent = formatDate();
    this.renderAttention();
    this.renderMissions();
    this.renderTimeline();
    this.renderInspector();
    this.renderReviews();
    this.renderSkills();
    DOM.query('#finding-summary').textContent = `${formatCents(repository.finding.expectedIgvCents)} expected · ${formatCents(repository.finding.sireIgvCents)} SIRE · Δ ${formatCents(repository.finding.sireIgvCents - repository.finding.expectedIgvCents)}`;
    DOM.query('#mission-control-list').setAttribute('aria-busy', 'false');
  },

  renderAttention() {
    const cards = repository.attention.map((item) => {
      const card = DOM.create('button', `attention-card ${item.tone}`);
      card.type = 'button';
      card.dataset.action = item.action;
      card.setAttribute('aria-label', `${item.severity}: ${item.title}. ${item.detail}`);
      const marker = DOM.create('span', 'attention-marker', item.severity);
      const copy = DOM.create('span', 'attention-copy');
      copy.append(DOM.create('strong', '', item.title), DOM.create('small', '', formatTemplate(item.detail)));
      const action = DOM.create('span', 'attention-action', item.action);
      const content = DOM.create('span', 'attention-content');
      content.append(marker, copy);
      card.append(DOM.create('span', 'attention-icon', item.icon), content, action, DOM.create('span', 'attention-arrow', '→'));
      return card;
    });
    DOM.replace(DOM.query('#attention-list'), cards);
  },

    renderMissions() {
      const missions = state.missions.filter((mission) => missionMatchesFilter(mission, state.missionFilter));
      const cards = missions.map((mission) => {
        const card = DOM.create('article', `mission-card ${mission.status}`);
        const identity = DOM.create('div', 'mission-card-identity');
        identity.append(DOM.create('span', `mission-status-dot ${mission.status}`), DOM.create('span', 'mission-id', mission.id));
        let statusClass = '';
        if (mission.status === 'completed') statusClass = 'ready';
        else if (mission.status === 'attention') statusClass = 'review';
        const missionInfo = DOM.create('div', 'mission-info');
        missionInfo.append(identity, DOM.create('h3', '', mission.title), DOM.create('p', 'mission-company', `${mission.type} · ${mission.company}`), DOM.create('span', `status-pill ${statusClass}`, mission.label));

        const workflow = DOM.create('div', 'workflow-state');
        workflow.append(DOM.create('span', 'workflow-label', `Current phase · ${mission.stage}`));
        const stages = DOM.create('div', 'workflow-stages');
        let workflowStage = mission.stage;
        if (mission.stage === 'Receipt signed') workflowStage = 'Receipt';
        const currentIndex = mission.workflow.indexOf(workflowStage);
        mission.workflow.forEach((stage, index) => {
          let stateName = '';
          if (index < currentIndex || mission.status === 'completed') stateName = 'complete';
          else if (index === currentIndex) stateName = 'current';
          const node = DOM.create('span', `workflow-stage ${stateName}`);
          node.append(DOM.create('i', ''), DOM.create('small', '', stage));
          stages.append(node);
        });
        workflow.append(stages, DOM.create('small', 'workflow-event', mission.event));

        const runtime = DOM.create('div', 'mission-runtime');
        runtime.append(this.runtimeFact('Evidence', mission.evidence), this.runtimeFact('Owner', mission.owner), this.runtimeFact('Receipt', mission.receipt), this.runtimeFact('Updated', mission.updated));
        const open = DOM.create('button', 'text-button', mission.status === 'completed' ? 'Inspect receipt →' : 'Open workspace →');
        open.type = 'button';
        open.dataset.openMission = mission.id;
        runtime.append(open);
        card.append(missionInfo, workflow, runtime);
        return card;
      });
      DOM.replace(DOM.query('#mission-control-list'), cards.length ? cards : [DOM.create('p', 'empty-copy', 'No missions match this view.')]);
    },

    runtimeFact(label, value) {
      const fact = DOM.create('span', 'runtime-fact');
      fact.append(DOM.create('small', '', label), DOM.create('strong', '', value));
      return fact;
    },

  renderTimeline() {
    const nodes = state.activity.map((event) => {
      const item = DOM.create('div', `timeline-item ${event.state}`);
      const marker = DOM.create('span', 'timeline-marker', event.icon);
      const copy = DOM.create('div', 'timeline-copy');
      copy.append(DOM.create('strong', '', event.title), DOM.create('p', '', formatTemplate(event.detail)));
      item.append(marker, copy, DOM.create('time', '', event.time));
      return item;
    });
    DOM.replace(DOM.query('#mission-timeline'), nodes);
  },

  renderInspector() {
    const content = DOM.create('div', 'inspector-content');
    if (state.inspectorTab === 'context') {
      content.append(DOM.create('span', 'inspector-kicker', 'Bound context'));
      content.append(this.inspectorRow('Company', 'ACME SAC'));
      content.append(this.inspectorRow('RUC scope', '20123456789 · Locked'));
      content.append(this.inspectorRow('Fiscal period', 'July 2026'));
      content.append(this.inspectorRow('Mission', 'M-2048 · Monthly close'));
      content.append(DOM.create('div', 'inspector-callout', 'The browser can display scope, but native gates own authorization.'));
    } else if (state.inspectorTab === 'evidence') {
      content.append(DOM.create('span', 'inspector-kicker', 'Evidence lineage'));
      content.append(this.inspectorRow('Sources', '17 attached records'));
      content.append(this.inspectorRow('Derived finding', `IGV variance · ${formatCents(repository.finding.sireIgvCents - repository.finding.expectedIgvCents)}`));
      content.append(this.inspectorRow('Hash status', 'All subjects verified'));
      const evidenceButton = DOM.create('button', 'button button-secondary full-button', 'Open evidence graph →');
      evidenceButton.type = 'button';
      evidenceButton.dataset.section = 'evidence';
      content.append(evidenceButton);
    } else {
      content.append(DOM.create('span', 'inspector-kicker', 'Guardian preflight'));
      ['Identity', 'Tenant scope', 'Fiscal period', 'Evidence completeness', 'Materiality'].forEach((label) => content.append(this.checkRow(label)));
      content.append(DOM.create('div', 'inspector-callout warning-callout', 'External actions require explicit human approval.'));
    }
    DOM.replace(DOM.query('#inspector-body'), [content]);
  },

  inspectorRow(label, value) {
    const row = DOM.create('div', 'inspector-row');
    row.append(DOM.create('small', '', label), DOM.create('strong', '', value));
    return row;
  },

  checkRow(label) {
    const row = DOM.create('div', 'inspector-check');
    row.append(DOM.create('span', '', '✓'), DOM.create('strong', '', label), DOM.create('small', '', 'Passed'));
    return row;
  },

  renderReviews() {
    const rows = repository.reviews.map((review) => {
      const row = DOM.create('button', `review-row ${state.selectedReview.id === review.id ? 'selected' : ''}`);
      row.type = 'button';
      row.dataset.reviewId = review.id;
      const markerIcon = review.type === 'discrepancy' ? 'Δ' : review.type === 'approval' ? '✓' : '⌁';
      const marker = DOM.create('span', `review-marker ${review.type}`, markerIcon);
      const copy = DOM.create('span', 'review-row-copy');
      copy.append(DOM.create('strong', '', review.title), DOM.create('small', '', review.meta));
      row.append(marker, copy, DOM.create('span', 'status-pill review', review.risk));
      return row;
    });
    DOM.replace(DOM.query('#review-list'), rows);
    this.renderReviewDetail();
  },

  renderReviewDetail() {
    const review = state.selectedReview;
    const detail = DOM.query('#review-detail');
    detail.replaceChildren();
    const heading = DOM.create('div', 'panel-heading');
    const title = DOM.create('div');
    title.append(DOM.create('p', 'eyebrow', 'Selected review'), DOM.create('h3', '', review.title));
    heading.append(title, DOM.create('span', 'status-pill review', review.risk));
    detail.append(heading, DOM.create('p', 'review-summary', formatTemplate(review.summary)));

    const proposalText = review.type === 'discrepancy'
      ? 'Investigate and reconcile the SIRE variance'
      : review.type === 'classification'
        ? 'Apply verified professional services classification'
        : 'Authorize the monthly close gate';
    const proposal = DOM.create('div', 'review-proposal');
    proposal.append(DOM.create('span', 'eyebrow', 'Proposed action'), DOM.create('strong', '', proposalText));
    const evidence = DOM.create('div', 'review-evidence');
    evidence.append(DOM.create('span', 'eyebrow', 'Evidence'), DOM.create('span', '', '17 sources · Guardian preflight passed · Engram precedent found'));
    detail.append(proposal, evidence);

    const actions = DOM.create('div', 'review-actions');
    ['Reject', 'Modify', 'Approve'].forEach((label) => {
      const button = DOM.create('button', `button ${label === 'Approve' ? 'button-primary' : 'button-secondary'}`, label);
      button.type = 'button';
      button.dataset.reviewAction = label;
      actions.append(button);
    });
    detail.append(actions);
  },

  renderSkills() {
    const grid = DOM.query('#skill-grid');
    if (!grid) return;
    const cards = repository.skills.map((skill) => {
      const card = DOM.create('article', 'panel skill-card');
      card.append(DOM.create('span', 'skill-icon', skill.icon));
      const copy = DOM.create('div');
      copy.append(DOM.create('h3', '', skill.name), DOM.create('p', '', skill.detail));
      card.append(copy, DOM.create('span', 'status-pill ready', skill.status));
      return card;
    });
    DOM.replace(grid, cards);
  },

  parseRoute() {
    const raw = window.location.hash.slice(1);
    const [section = 'home', query = ''] = raw.split('?');
    return { section, params: new URLSearchParams(query) };
  },

  navigate(section, params = new URLSearchParams()) {
    if (!document.querySelector(`[data-page="${section}"]`)) return;
    route.section = section;
    route.params = params instanceof URLSearchParams ? params : new URLSearchParams(params);
    DOM.all('.page-section').forEach((page) => page.classList.toggle('active', page.id === section));
    DOM.all('[data-section]').forEach((link) => {
      if (link.classList.contains('nav-link') || link.classList.contains('settings-link')) link.classList.toggle('active', link.dataset.section === section);
      if (link.classList.contains('nav-link')) link.toggleAttribute('aria-current', link.dataset.section === section);
    });
    const query = route.params.toString();
    window.history.replaceState(null, '', `#${section}${query ? `?${query}` : ''}`);
    document.querySelector('.main-content')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  bindNavigation() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-section]');
      if (!target) return;
      event.preventDefault();
      this.navigate(target.dataset.section);
    });
  },

  bindMissionControls() {
    DOM.all('[data-mission-filter]').forEach((tab) => tab.addEventListener('click', () => {
      state.missionFilter = tab.dataset.missionFilter;
      DOM.all('[data-mission-filter]').forEach((item) => {
        item.classList.toggle('active', item === tab);
        item.setAttribute('aria-selected', String(item === tab));
      });
      this.renderMissions();
      this.navigate('home', new URLSearchParams({ filter: state.missionFilter }));
    }));
    DOM.query('#mission-control-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-open-mission]');
      if (button) this.navigate('missions');
    });
    DOM.query('#attention-list').addEventListener('click', () => this.navigate('review'));
  },

  bindInspector() {
    DOM.all('[data-inspector-tab]').forEach((tab) => tab.addEventListener('click', () => {
      state.inspectorTab = tab.dataset.inspectorTab;
      DOM.all('[data-inspector-tab]').forEach((item) => {
        item.classList.toggle('active', item === tab);
        item.setAttribute('aria-selected', String(item === tab));
      });
      this.renderInspector();
      this.navigate('missions', new URLSearchParams({ tab: state.inspectorTab }));
    }));
  },

  bindComposer() {
    DOM.all('[data-composer-token]').forEach((button) => button.addEventListener('click', () => {
      const input = DOM.query('#composer-input');
      input.value += `${button.dataset.composerToken} `;
      input.focus();
    }));
    DOM.query('#composer-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = DOM.query('#composer-input');
      if (!input.value.trim()) return this.showToast('Write a request before sending it to Drenyra.');
      state.activity.push({ state: 'current', icon: '✦', title: 'Operator request staged', detail: 'The local API adapter would route this through native mission contracts', time: 'Just now' });
      this.renderTimeline();
      input.value = '';
      this.showToast('Request staged in prototype mode.');
    });
  },

  bindGlobalChat() {
    const input = DOM.query('#global-chat-input');
    const form = DOM.query('#global-chat-form');
    DOM.all('[data-global-token]').forEach((button) => button.addEventListener('click', () => {
      input.value += `${button.dataset.globalToken} `;
      input.focus();
    }));
    DOM.all('[data-global-action]').forEach((button) => button.addEventListener('click', () => {
      input.value = button.dataset.globalAction;
      this.routeOperatorRequest(input.value);
      input.value = '';
    }));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const request = input.value.trim();
      if (!request) { input.focus(); return this.showToast('Tell Drenyra what to operate.'); }
      this.routeOperatorRequest(request);
      input.value = '';
    });
  },

  routeOperatorRequest(request) {
    const action = request.toLowerCase().match(/\/(reconcile|close|review|evidence|engram|guardian|audit|mission|help)\b/)?.[1];
    const destinations = { reconcile: 'missions', close: 'missions', review: 'review', evidence: 'evidence', engram: 'engram', guardian: 'guardian', audit: 'guardian' };
    if (action === 'mission') return this.openMissionDialog();
    if (action === 'help') return this.openCommands();
    if (action && destinations[action]) {
      this.navigate(destinations[action]);
      if (destinations[action] === 'missions') DOM.query('#composer-input').value = request;
      this.stageOperatorEvent(request, `Opening ${destinations[action]} workspace`);
      return;
    }
    this.navigate('missions');
    DOM.query('#composer-input').value = request;
    this.stageOperatorEvent(request, 'Request staged for the current mission');
  },

  stageOperatorEvent(request, detail) {
    state.activity.unshift({ state: 'current', icon: '✦', title: 'Operator request staged', detail: `${detail} · ${request}`, time: 'Just now' });
    this.renderTimeline();
    this.showToast('Request staged in prototype mode.');
  },

  bindRefresh() {
    DOM.query('#refresh-button').addEventListener('click', () => {
      const container = DOM.query('#mission-control-list');
      container.setAttribute('aria-busy', 'true');
      DOM.replace(container, [DOM.create('div', 'skeleton-row'), DOM.create('div', 'skeleton-row'), DOM.create('div', 'skeleton-row')]);
      DOM.query('#last-sync').textContent = 'Syncing…';
      window.setTimeout(() => {
        DOM.query('#last-sync').textContent = 'Synced just now';
        this.renderAll();
        this.showToast('Workspace refreshed. Native services remain disconnected.');
      }, 450);
    });
  },

  bindTheme() {
    const toggle = DOM.query('#theme-toggle');
    const apply = (theme) => {
      document.documentElement.dataset.theme = theme;
      const oled = theme === 'oled';
      toggle.setAttribute('aria-label', oled ? 'Switch to Dreamcoder Light theme' : 'Switch to Black OLED theme');
      toggle.textContent = oled ? '☼' : '◐';
    };
    let saved = 'light';
    try { saved = window.localStorage.getItem('drenyra-theme') ?? 'light'; } catch { /* private browsing */ }
    apply(saved === 'oled' ? 'oled' : 'light');
    toggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'oled' ? 'light' : 'oled';
      apply(next);
      try { window.localStorage.setItem('drenyra-theme', next); } catch { /* private browsing */ }
    });
  },

  bindResize() {
    const layout = DOM.query('.mission-layout');
    const handle = DOM.query('#inspector-resize');
    if (!layout || !handle) return;
    let resizing = false;
    const setWidth = (clientX) => {
      const bounds = layout.getBoundingClientRect();
      const width = Math.min(460, Math.max(250, bounds.right - clientX));
      layout.style.gridTemplateColumns = `minmax(0, 1fr) ${width}px`;
    };
    handle.addEventListener('pointerdown', (event) => {
      resizing = true;
      layout.classList.add('is-resizing');
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => { if (resizing) setWidth(event.clientX); });
    handle.addEventListener('pointerup', () => { resizing = false; layout.classList.remove('is-resizing'); });
    handle.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const current = layout.getBoundingClientRect().right - DOM.query('.inspector').getBoundingClientRect().width;
      setWidth(current + (event.key === 'ArrowLeft' ? 24 : -24));
    });
  },

  bindWorkspaceTabs() {
    DOM.all('[data-workspace-view]').forEach((tab) => tab.addEventListener('click', () => {
      const view = tab.dataset.workspaceView;
      DOM.all('[data-workspace-view]').forEach((item) => {
        const selected = item === tab;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      const destinations = { activity: 'missions', evidence: 'evidence', decisions: 'review', receipts: 'guardian' };
      this.navigate(destinations[view] ?? 'missions', new URLSearchParams({ view }));
    }));
  },

  bindMissionCreation() {
    const dialog = DOM.query('#mission-dialog');
    const form = DOM.query('#mission-form');
    this.openMissionDialog = () => { dialog.showModal(); DOM.query('#mission-company').focus(); };
    DOM.query('#new-mission-button').addEventListener('click', this.openMissionDialog);
    DOM.query('#cancel-mission').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = new FormData(form);
          const id = `M-${2050 + state.missions.length}`;
          state.missions.unshift({
            id,
            title: `${values.get('intent')} · ${values.get('period')}`,
            type: 'Mission',
            company: String(values.get('company')),
            status: 'running',
            label: 'Running',
            progress: '0%',
            stage: 'Scope',
            workflow: ['Scope', 'Evidence', 'Reconcile', 'Review', 'Receipt'],
            agents: '1 agent',
            event: 'Mission staged',
            risk: 'Pending checks',
            evidence: 'Pending',
            owner: 'Operator',
            receipt: 'Not issued',
            updated: 'Just now',
          });
      state.activity.unshift({ state: 'current', icon: '↗', title: `${id} created`, detail: 'Mission scope staged for native validation', time: 'Just now' });
      form.reset();
      dialog.close();
      this.renderAll();
      this.navigate('missions');
      this.showToast(`${id} staged in prototype mode.`);
    });
  },

  bindReview() {
    DOM.query('#review-list').addEventListener('click', (event) => {
      const row = event.target.closest('[data-review-id]');
      if (!row) return;
      state.selectedReview = repository.reviews.find((review) => review.id === row.dataset.reviewId) ?? repository.reviews[0];
      this.renderReviews();
    });
    DOM.query('#review-detail').addEventListener('click', (event) => {
      const action = event.target.closest('[data-review-action]')?.dataset.reviewAction;
      if (!action) return;
      state.activity.unshift({ state: action === 'Approve' ? 'done' : 'current', icon: action === 'Approve' ? '✓' : '✦', title: `Review action: ${action}`, detail: 'Prototype action recorded; native receipt flow remains pending', time: 'Just now' });
      this.renderTimeline();
      this.showToast(`${action} staged in prototype mode.`);
    });
  },

  bindCommands() {
    const dialog = DOM.query('#command-dialog');
    const input = DOM.query('#command-input');
    const list = DOM.query('#command-list');
    let activeIndex = 0;
    const commands = [
      { icon: '◈', title: 'Create Monthly Close mission', meta: 'Missions · July 2026', action: 'createMission' },
      { icon: 'Δ', title: 'Reconcile SIRE', meta: 'Actions · Current workspace', action: 'composeReconcile' },
      { icon: '✓', title: 'Open pending reviews', meta: 'Review · Four items', action: 'review' },
      { icon: '▱', title: 'Trace evidence lineage', meta: 'Evidence · M-2048', action: 'evidence' },
      { icon: '◇', title: 'Search institutional memory', meta: 'Engram · Verified context', action: 'engram' },
    ];
    const renderCommands = (query = '') => {
      const filtered = commands.filter((command) => `${command.title} ${command.meta}`.toLowerCase().includes(query.toLowerCase()));
      const nodes = filtered.map((command) => {
        const row = DOM.create('button', 'command-row');
        row.type = 'button'; row.dataset.commandAction = command.action;
        row.append(DOM.create('span', 'command-icon', command.icon));
        const copy = DOM.create('span'); copy.append(DOM.create('strong', '', command.title), DOM.create('small', '', command.meta));
        row.append(copy, DOM.create('span', 'command-arrow', '↵'));
        return row;
      });
      activeIndex = 0;
      DOM.replace(list, nodes.length ? nodes : [DOM.create('p', 'empty-copy', 'No commands found.')]);
    };
    this.openCommands = () => { renderCommands(); dialog.showModal(); input.value = ''; input.focus(); };
    const moveCommand = (delta) => {
      const rows = DOM.all('#command-list [data-command-action]');
      if (!rows.length) return;
      activeIndex = (activeIndex + delta + rows.length) % rows.length;
      rows[activeIndex].focus();
    };
    input.addEventListener('input', () => renderCommands(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); moveCommand(1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); moveCommand(-1); }
      if (event.key === 'Enter') { event.preventDefault(); DOM.all('#command-list [data-command-action]')[activeIndex]?.click(); }
    });
    list.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); moveCommand(1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); moveCommand(-1); }
    });
    list.addEventListener('click', (event) => {
      const command = event.target.closest('[data-command-action]');
      if (!command) return;
      dialog.close();
      this.runCommand(command.dataset.commandAction);
    });
  },

  runCommand(action) {
    if (action === 'createMission') return this.openMissionDialog();
    if (action === 'composeReconcile') { this.navigate('missions'); DOM.query('#composer-input').value = '/reconcile @evidence '; DOM.query('#composer-input').focus(); return; }
    this.navigate(action);
  },

  bindGlobalKeyboard() {
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); this.openCommands(); return; }
      const target = event.target;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
      if (event.key === '/' && !editing) { event.preventDefault(); this.navigate('missions'); DOM.query('#composer-input').focus(); }
    });
  },

  openFromHash() {
    const parsed = this.parseRoute();
    const requestedFilter = parsed.params.get('filter');
    const requestedTab = parsed.params.get('tab');
    if (['running', 'attention', 'completed'].includes(requestedFilter)) state.missionFilter = requestedFilter;
    if (['context', 'evidence', 'guardian'].includes(requestedTab)) state.inspectorTab = requestedTab;
    this.navigate(parsed.section, parsed.params);
    DOM.all('[data-mission-filter]').forEach((tab) => {
      const selected = tab.dataset.missionFilter === state.missionFilter;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    DOM.all('[data-inspector-tab]').forEach((tab) => {
      const selected = tab.dataset.inspectorTab === state.inspectorTab;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    this.renderMissions();
    this.renderInspector();
  },

  showToast(message) {
    const toast = DOM.query('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
  },
};

App.init();
