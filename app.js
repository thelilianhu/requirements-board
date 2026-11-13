/**
 * 需求管理只读看板（静态版）
 * 数据来自同目录 data.json，渲染逻辑与 DSH 需求管理面板保持一致：
 * 阶段步骤条、表头多选筛选、OBP 推导、细进度条，全部只读。
 */
(function () {
  'use strict';

  const STATUSES = ['backlog', 'analysis', 'walkthrough', 'planned', 'doing', 'review', 'done'];
  const STAGES = ['analysis', 'walkthrough', 'planned', 'doing', 'review', 'done'];
  const STATUS_LABELS = {
    backlog: '原始需求',
    analysis: '方案分析',
    walkthrough: '需求串讲',
    planned: '已基线',
    doing: '开发中',
    review: '测试中',
    done: '已上线',
  };
  const STATUS_COLORS = {
    backlog: 'var(--req-txt-3)',
    analysis: 'var(--req-teal)',
    walkthrough: 'var(--req-rose)',
    planned: 'var(--req-blue)',
    doing: 'var(--req-amber)',
    review: 'var(--req-violet)',
    done: 'var(--req-green)',
  };
  const PRIORITIES = ['p0', 'p1', 'p2', ''];
  const PRIORITY_LABELS = { p0: 'P0', p1: 'P1', p2: 'P2', '': '未填' };
  const PRIORITY_COLORS = {
    p0: 'var(--req-rose)',
    p1: 'var(--req-orange)',
    p2: 'var(--req-blue)',
  };
  const CATEGORY_COLORS = {
    blue: 'var(--req-blue)',
    violet: 'var(--req-violet)',
    teal: 'var(--req-teal)',
    green: 'var(--req-green)',
    amber: 'var(--req-amber)',
    orange: 'var(--req-orange)',
    rose: 'var(--req-rose)',
    slate: 'var(--req-slate)',
  };

  const ICONS = {
    inbox:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.4 12.4 6.7 5.9A2 2 0 0 1 8.6 4.6h6.8a2 2 0 0 1 1.9 1.3l2.3 6.5v4.3a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4.4 12.4h4.1l.9 1.9h5.2l.9-1.9h4.1" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    list:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.4 6.5h11M8.4 12h11M8.4 17.5h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4.8" cy="6.5" r="1.2" fill="currentColor"/><circle cx="4.8" cy="12" r="1.2" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1.2" fill="currentColor"/></svg>',
  };

  const state = {
    status: 'loading', // loading | ready | error
    error: null,
    view: 'list', // list | raws
    query: '',
    filters: { category: [], priority: [], status: [], obp: [] },
    sort: 'updated', // updated | progress
    openMenu: '',
    shownCount: 0,
    requirements: [],
    categories: [],
    raws: [],
    categoryMap: new Map(),
    requirementMap: new Map(),
  };

  const els = {
    steps: document.getElementById('steps'),
    tabs: document.querySelector('[data-req-tabs]'),
    body: document.getElementById('body'),
    foot: document.getElementById('foot'),
  };

  /* ── tiny DOM helpers ───────────────────────────────────────────────── */

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function icon(name) {
    const span = node('span', 'dsw-req-empty-icon');
    span.innerHTML = ICONS[name] || ICONS.inbox;
    return span;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function clampPercent(value) {
    const number = Math.round(Number(value) || 0);
    return Math.max(0, Math.min(100, number));
  }

  function hashOf(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  /** OBP：15 日为基线，15 日（含）前归当月，之后归下月。 */
  function obpOf(createdAt) {
    const date = new Date(createdAt || '');
    if (Number.isNaN(date.getTime())) return '';
    let year = date.getFullYear();
    let month = date.getMonth();
    if (date.getDate() > 15) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return `${year}-${pad(month + 1)}`;
  }

  function formatDateTime(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatRawTime(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function snapshotLabel() {
    const times = state.requirements
      .concat(state.raws)
      .map((item) => new Date(item.updatedAt || '').getTime())
      .filter((time) => !Number.isNaN(time));
    if (!times.length) return '';
    return formatDateTime(Math.max.apply(null, times));
  }

  function hasActiveFilters() {
    return Boolean(state.query.trim()) || Object.keys(state.filters).some((key) => state.filters[key].length > 0);
  }

  function clearFilters() {
    state.query = '';
    state.filters = { category: [], priority: [], status: [], obp: [] };
    state.openMenu = '';
    render();
  }

  function categoryName(categoryId) {
    const category = state.categoryMap.get(categoryId);
    return category ? category.name : '未分配';
  }

  /* ── data loading ───────────────────────────────────────────────────── */

  function normalizeRequirement(item) {
    const status = STATUSES.indexOf(item.status) >= 0 ? item.status : 'backlog';
    const priority = PRIORITIES.indexOf(item.priority) >= 0 ? item.priority : '';
    return {
      id: String(item.id || ''),
      title: String(item.title || '未命名需求'),
      description: item.description ? String(item.description) : '',
      status,
      priority,
      progress: clampPercent(item.progress),
      owner: item.owner ? String(item.owner) : '',
      categoryId: item.categoryId ? String(item.categoryId) : '',
      createdAt: item.createdAt || '',
      updatedAt: item.updatedAt || '',
    };
  }

  function normalizeRaw(item) {
    return {
      id: String(item.id || ''),
      title: String(item.title || '未命名原始诉求'),
      detail: item.detail ? String(item.detail) : '',
      proposer: item.proposer ? String(item.proposer) : '',
      supported: Boolean(item.supported),
      supportedNote: item.supportedNote ? String(item.supportedNote) : '',
      importedRequirementIds: Array.isArray(item.importedRequirementIds)
        ? item.importedRequirementIds.map(String)
        : [],
      createdAt: item.createdAt || '',
      updatedAt: item.updatedAt || '',
    };
  }

  function loadData() {
    state.status = 'loading';
    state.error = null;
    render();
    fetch('./data.json', { cache: 'no-store', headers: { accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!data || !Array.isArray(data.requirements)) {
          throw new Error('data.json 格式不正确');
        }
        state.requirements = data.requirements.map(normalizeRequirement);
        state.categories = (Array.isArray(data.categories) ? data.categories : [])
          .filter((item) => item && item.id)
          .map((item) => ({
            id: String(item.id),
            name: String(item.name || '未命名项目'),
            color: CATEGORY_COLORS[item.color] ? item.color : 'slate',
          }));
        state.raws = (Array.isArray(data.raws) ? data.raws : []).map(normalizeRaw);
        state.categoryMap = new Map(state.categories.map((item) => [item.id, item]));
        state.requirementMap = new Map(state.requirements.map((item) => [item.id, item]));
        state.status = 'ready';
        state.error = null;
        render();
      })
      .catch((error) => {
        console.error('[需求看板] 加载 data.json 失败：', error);
        state.status = 'error';
        state.error = error;
        render();
      });
  }

  /* ── filtering / sorting ────────────────────────────────────────────── */

  function visibleRequirements() {
    const needle = state.query.trim().toLocaleLowerCase();
    const filters = state.filters;
    const rows = state.requirements.filter((requirement) => {
      if (filters.status.length && filters.status.indexOf(requirement.status) < 0) return false;
      if (filters.priority.length && filters.priority.indexOf(requirement.priority || 'none') < 0) return false;
      if (filters.category.length && filters.category.indexOf(requirement.categoryId || 'none') < 0) return false;
      if (filters.obp.length && filters.obp.indexOf(obpOf(requirement.createdAt)) < 0) return false;
      if (!needle) return true;
      const haystack = [
        requirement.title,
        requirement.description,
        requirement.owner,
        categoryName(requirement.categoryId),
      ]
        .join('\n')
        .toLocaleLowerCase();
      return haystack.indexOf(needle) >= 0;
    });
    rows.sort((left, right) => {
      if (state.sort === 'progress') {
        if (right.progress !== left.progress) return right.progress - left.progress;
        return PRIORITIES.indexOf(left.priority) - PRIORITIES.indexOf(right.priority);
      }
      return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
    });
    return rows;
  }

  /* ── render: tabs + steps ───────────────────────────────────────────── */

  function renderTabs() {
    if (!els.tabs) return;
    Array.prototype.forEach.call(els.tabs.querySelectorAll('[data-view]'), (button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    if (els.steps) els.steps.hidden = state.view === 'raws';
  }

  function renderSteps() {
    if (!els.steps) return;
    const counts = {};
    STATUSES.forEach((status) => {
      counts[status] = 0;
    });
    state.requirements.forEach((requirement) => {
      counts[requirement.status] = (counts[requirement.status] || 0) + 1;
    });
    const ready = state.status === 'ready';
    Array.prototype.forEach.call(els.steps.querySelectorAll('[data-step]'), (button) => {
      const key = button.dataset.step;
      const active =
        key === 'all'
          ? state.filters.status.length === 0
          : state.filters.status.length === 1 && state.filters.status[0] === key;
      const count = key === 'all' ? state.requirements.length : counts[key] || 0;
      button.classList.toggle('is-active', active);
      button.classList.toggle('is-empty', ready && key !== 'all' && count === 0);
      button.setAttribute('aria-selected', String(active));
      const countEl = button.querySelector('[data-count]');
      if (countEl) countEl.textContent = ready ? String(count) : '–';
    });
  }

  function renderFoot() {
    els.foot.replaceChildren();
    if (state.status === 'loading') {
      els.foot.append(node('span', null, '正在加载 data.json…'));
      els.foot.append(footState('只读快照', 'is-loading'));
      return;
    }
    if (state.status === 'error') {
      els.foot.append(node('span', null, '数据加载失败'));
      els.foot.append(footState('只读快照', 'is-error'));
      return;
    }
    if (state.view === 'raws') {
      els.foot.append(node('span', null, `${state.raws.length} 条原始诉求`));
    } else {
      const total = state.requirements.length;
      els.foot.append(
        node(
          'span',
          null,
          hasActiveFilters() ? `${state.shownCount} / ${total} 条需求` : `${total} 条需求`,
        ),
      );
    }
    const snapshot = snapshotLabel();
    els.foot.append(
      footState(snapshot ? `只读快照 · 更新于 ${snapshot}` : '只读快照 · data.json', ''),
    );
  }

  function footState(text, tone) {
    const wrap = node('span', 'dsw-req-foot-state');
    const dot = node('span', `dsw-req-foot-dot${tone ? ' ' + tone : ''}`);
    dot.setAttribute('aria-hidden', 'true');
    const label = node('span', 'dsw-req-foot-label', text);
    wrap.title = '静态页面，只读渲染 data.json；不会写入本地需求面板';
    wrap.append(dot, label);
    return wrap;
  }

  /* ── render: body ───────────────────────────────────────────────────── */

  function renderBody() {
    els.body.replaceChildren();
    document.body.dataset.state = state.status;
    if (state.status === 'loading') {
      const loading = node('div', 'dsw-req-loading');
      const spinner = node('span', 'dsw-req-spinner');
      spinner.setAttribute('aria-hidden', 'true');
      loading.append(spinner, document.createTextNode('正在读取 data.json…'));
      els.body.append(loading);
      state.shownCount = 0;
      return;
    }
    if (state.status === 'error') {
      els.body.append(errorView());
      state.shownCount = 0;
      return;
    }
    if (state.view === 'raws') {
      renderRaws();
      return;
    }
    const rows = visibleRequirements();
    state.shownCount = rows.length;
    if (!state.requirements.length) {
      els.body.append(
        emptyView(
          '还没有需求',
          '本地需求管理面板中创建需求后，重新运行 sync.sh 拉取 data.json，这里就会显示。',
          null,
        ),
      );
      return;
    }
    if (!rows.length) {
      els.body.append(emptyView('没有符合筛选条件的需求', '换一个关键词，或清除筛选后再试。', 'clear'));
      return;
    }
    els.body.append(listView(rows));
  }

  function errorView() {
    const card = node('div', 'dsw-req-empty is-error');
    card.append(icon('inbox'));
    card.append(node('div', 'dsw-req-empty-title', '加载 data.json 失败'));

    const hint = node('div', 'dsw-req-empty-hint');
    if (window.location.protocol === 'file:') {
      hint.append(document.createTextNode('浏览器在 '));
      hint.append(node('code', null, 'file://'));
      hint.append(document.createTextNode(' 下通常会拦截 fetch。请在 board 目录运行 '));
      hint.append(node('code', null, 'python3 -m http.server 8000'));
      hint.append(document.createTextNode('，再打开 '));
      hint.append(node('code', null, 'http://localhost:8000/'));
      hint.append(document.createTextNode('。'));
    } else {
      hint.append(document.createTextNode('请确认 data.json 与 index.html 在同一目录，并重新运行 '));
      hint.append(node('code', null, 'sync.sh'));
      hint.append(document.createTextNode(' 拉取数据。'));
    }
    card.append(hint);

    if (state.error && state.error.message) {
      const detail = node('div', 'dsw-req-empty-hint', `错误信息：${state.error.message}`);
      card.append(detail);
    }

    const retry = node('button', 'dsw-req-btn', '重试');
    retry.type = 'button';
    retry.addEventListener('click', loadData);
    card.append(retry);
    return card;
  }

  function emptyView(title, hint, action) {
    const card = node('div', 'dsw-req-empty');
    card.append(icon('inbox'));
    card.append(node('div', 'dsw-req-empty-title', title));
    card.append(node('div', 'dsw-req-empty-hint', hint));
    if (action === 'clear') {
      const button = node('button', 'dsw-req-btn', '清除筛选');
      button.type = 'button';
      button.addEventListener('click', clearFilters);
      card.append(button);
    }
    return card;
  }

  /* ── list view ──────────────────────────────────────────────────────── */

  function listView(rows) {
    const list = node('div', 'dsw-req-list');
    list.setAttribute('data-req-list', '');

    const head = node('div', 'dsw-req-list-head');
    head.setAttribute('role', 'row');

    const searchCell = node('span', 'dsw-req-head-cell');
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'dsw-req-head-input';
    search.placeholder = '搜索需求';
    search.value = state.query;
    search.autocomplete = 'off';
    search.spellcheck = false;
    search.setAttribute('data-search', '');
    search.setAttribute('aria-label', '需求标题');
    search.title = '需求标题 · 搜索标题 / 描述 / 负责人 / 项目';
    bindSearch(search);
    searchCell.append(search);
    head.append(searchCell);

    head.append(filterMenu('category', '项目', categoryOptions(), 'dsw-req-col-cat'));
    head.append(filterMenu('priority', '优先级', priorityOptions(), 'dsw-req-col-pri'));
    head.append(filterMenu('status', '状态', statusOptions(), 'dsw-req-col-status'));
    head.append(filterMenu('obp', 'OBP', obpOptions(), 'dsw-req-col-obp'));

    const progressHead = node('span', 'dsw-req-head-cell dsw-req-col-progress');
    const sortButton = node('button', 'dsw-req-head-sort', '进度');
    sortButton.type = 'button';
    sortButton.classList.toggle('is-active', state.sort === 'progress');
    sortButton.title =
      state.sort === 'progress' ? '按进度排序（再次点击恢复最近更新）' : '按进度排序';
    sortButton.addEventListener('click', () => {
      state.sort = state.sort === 'progress' ? 'updated' : 'progress';
      render();
    });
    progressHead.append(sortButton);
    head.append(progressHead);

    head.append(node('span', 'dsw-req-col-owner', '负责人'));
    list.append(head);

    const listBody = node('div', 'dsw-req-list-body');
    rows.forEach((requirement) => {
      const row = node('div', 'dsw-req-row');
      row.setAttribute('role', 'row');
      row.dataset.reqId = requirement.id;

      const titleCell = node('span', 'dsw-req-row-title');
      const title = node('span', 'dsw-req-row-name', requirement.title);
      title.title = requirement.title;
      titleCell.append(title);

      const categoryCell = node('span', 'dsw-req-row-cat dsw-req-col-cat');
      categoryCell.append(categoryChip(requirement.categoryId));

      const priorityCell = node('span', 'dsw-req-row-pri dsw-req-col-pri');
      priorityCell.append(priorityBadge(requirement.priority));

      const statusCell = node('span', 'dsw-req-col-status');
      statusCell.append(statusText(requirement.status));

      const obp = node('span', 'dsw-req-row-obp dsw-req-col-obp', obpOf(requirement.createdAt) || '—');
      obp.title = `OBP ${obpOf(requirement.createdAt) || '未知'}`;

      const progressCell = progressView(requirement);

      const ownerCell = node('span', 'dsw-req-row-owner dsw-req-col-owner');
      ownerCell.append(avatar(requirement.owner));
      ownerCell.append(node('span', 'dsw-req-row-owner-name', requirement.owner || '未指派'));
      ownerCell.title = requirement.owner || '未指派';

      row.append(titleCell, categoryCell, priorityCell, statusCell, obp, progressCell, ownerCell);
      listBody.append(row);
    });
    list.append(listBody);
    return list;
  }

  function bindSearch(input) {
    input.addEventListener('compositionstart', () => {
      input.dataset.composing = '1';
    });
    input.addEventListener('compositionend', () => {
      delete input.dataset.composing;
      state.query = input.value;
      render();
    });
    input.addEventListener('input', () => {
      state.query = input.value;
      if (input.dataset.composing === '1') return;
      window.clearTimeout(bindSearch.timer);
      bindSearch.timer = window.setTimeout(render, 90);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.query) {
        event.stopPropagation();
        state.query = '';
        render();
      }
    });
  }

  function categoryOptions() {
    const options = state.categories.map((category) => ({ value: category.id, label: category.name }));
    const uncategorized = state.requirements.filter((requirement) => !requirement.categoryId).length;
    if (uncategorized > 0) options.push({ value: 'none', label: '未分配' });
    return options;
  }

  function priorityOptions() {
    return [
      { value: 'p0', label: 'P0' },
      { value: 'p1', label: 'P1' },
      { value: 'p2', label: 'P2' },
      { value: 'none', label: '未填' },
    ];
  }

  function statusOptions() {
    return STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }));
  }

  function obpOptions() {
    const values = Array.from(
      new Set(state.requirements.map((requirement) => obpOf(requirement.createdAt)).filter(Boolean)),
    ).sort((left, right) => right.localeCompare(left));
    return values.map((value) => ({ value, label: `${value} OBP` }));
  }

  function filterMenu(key, label, options, extraClass) {
    const wrap = node('span', `dsw-req-head-cell dsw-req-filter-wrap${extraClass ? ' ' + extraClass : ''}`);
    wrap.setAttribute('data-filter-wrap', key);
    if (key === 'obp') wrap.classList.add('is-right');

    const selected = state.filters[key];
    const button = node('button', 'dsw-req-head-select', selected.length ? `${label} · ${selected.length}` : label);
    button.type = 'button';
    button.dataset.filterToggle = key;
    button.setAttribute('aria-expanded', String(state.openMenu === key));
    button.setAttribute('aria-label', `${label}筛选${selected.length ? `，已选 ${selected.length} 项` : ''}`);
    if (selected.length) {
      const labels = options
        .filter((option) => selected.indexOf(option.value) >= 0)
        .map((option) => option.label);
      button.title = `已选：${labels.join('、')}（点击调整）`;
    } else {
      button.title = `${label}筛选`;
    }
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (state.openMenu === key) {
        closeMenuDom();
        return;
      }
      closeMenuDom();
      state.openMenu = key;
      const menu = buildMenu(key, label, options);
      wrap.append(menu);
      button.setAttribute('aria-expanded', 'true');
    });
    wrap.append(button);

    if (state.openMenu === key) wrap.append(buildMenu(key, label, options));
    return wrap;
  }

  function buildMenu(key, label, options) {
    const menu = node('div', 'dsw-req-filter-menu');
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', `${label}筛选`);
    const selected = state.filters[key];

    options.forEach((option) => {
      const optionLabel = node('label', 'dsw-req-filter-option');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = option.value;
      checkbox.checked = selected.indexOf(option.value) >= 0;
      checkbox.addEventListener('change', () => {
        const current = state.filters[key];
        state.filters[key] = checkbox.checked
          ? current.concat(option.value)
          : current.filter((value) => value !== option.value);
        render();
      });
      optionLabel.append(checkbox, document.createTextNode(option.label));
      menu.append(optionLabel);
    });

    if (selected.length) {
      const clear = node('button', 'dsw-req-filter-clear', '清除');
      clear.type = 'button';
      clear.addEventListener('click', (event) => {
        event.stopPropagation();
        state.filters[key] = [];
        render();
      });
      menu.append(clear);
    }
    return menu;
  }

  function closeMenuDom() {
    state.openMenu = '';
    Array.prototype.forEach.call(document.querySelectorAll('.dsw-req-filter-menu'), (menu) => menu.remove());
    Array.prototype.forEach.call(document.querySelectorAll('[data-filter-toggle]'), (button) => {
      button.setAttribute('aria-expanded', 'false');
    });
  }

  function categoryChip(categoryId) {
    const category = state.categoryMap.get(categoryId);
    const chip = node('span', `dsw-req-cat${category ? '' : ' is-none'}`);
    chip.style.setProperty('--req-cat', category ? CATEGORY_COLORS[category.color] : 'var(--req-slate)');
    const dot = node('span', 'dsw-req-cat-dot');
    dot.setAttribute('aria-hidden', 'true');
    chip.append(dot, document.createTextNode(category ? category.name : '未分配'));
    chip.title = category ? category.name : '未分配';
    return chip;
  }

  function priorityBadge(priority) {
    if (!priority) return node('span', 'dsw-req-pri is-none', '未填');
    const badge = node('span', 'dsw-req-pri', PRIORITY_LABELS[priority] || priority.toUpperCase());
    badge.style.setProperty('--req-pri', PRIORITY_COLORS[priority] || 'var(--req-slate)');
    badge.title = priority === 'p0' ? '紧急' : priority === 'p1' ? '高' : '中';
    return badge;
  }

  function statusText(status) {
    const wrap = node('span', 'dsw-req-row-status');
    const dot = node('span', 'dsw-req-status-dot');
    dot.setAttribute('aria-hidden', 'true');
    dot.style.setProperty('--req-status', STATUS_COLORS[status] || 'var(--req-slate)');
    wrap.append(dot, document.createTextNode(STATUS_LABELS[status] || status));
    return wrap;
  }

  function progressView(requirement) {
    const wrap = node('div', 'dsw-req-row-progress');
    wrap.setAttribute('role', 'progressbar');
    wrap.setAttribute('aria-valuenow', String(requirement.progress));
    wrap.setAttribute('aria-valuemin', '0');
    wrap.setAttribute('aria-valuemax', '100');
    wrap.setAttribute('aria-label', `进度 ${requirement.progress}%`);
    wrap.style.setProperty('--req-status', STATUS_COLORS[requirement.status] || 'var(--req-slate)');
    const track = node('div', 'dsw-req-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = node('span', 'dsw-req-fill');
    fill.style.width = `${requirement.progress}%`;
    track.append(fill);
    wrap.append(track, node('span', 'dsw-req-pct', `${requirement.progress}%`));
    return wrap;
  }

  function avatar(name) {
    const text = String(name || '').trim();
    const element = node('span', 'dsw-req-avatar');
    element.setAttribute('aria-hidden', 'true');
    if (!text) {
      element.classList.add('is-empty');
      element.textContent = '·';
      return element;
    }
    element.textContent = text.slice(0, 1).toUpperCase();
    element.dataset.tone = String(hashOf(text) % 8);
    return element;
  }

  /* ── raw view ───────────────────────────────────────────────────────── */

  function renderRaws() {
    if (!state.raws.length) {
      els.body.append(
        emptyView(
          '还没有原始诉求',
          '本地需求管理面板录入原始诉求后，重新运行 sync.sh 同步 data.json，这里就会显示。',
          null,
        ),
      );
      return;
    }
    const wrap = node('div', 'dsw-req-raws');
    wrap.setAttribute('data-req-raws', '');
    const list = node('div', 'dsw-req-list');
    list.setAttribute('data-req-raw-list', '');

    const head = node('div', 'dsw-req-list-head is-raw');
    head.setAttribute('role', 'row');
    head.append(
      node('span', null, '原始诉求'),
      node('span', 'dsw-req-raw-col-proposer', '提出人'),
      node('span', 'dsw-req-raw-col-support', '支持状态'),
      node('span', 'dsw-req-raw-col-imported', '已导入'),
    );
    list.append(head);

    const listBody = node('div', 'dsw-req-list-body');
    state.raws.forEach((raw) => {
      const item = node('div', 'dsw-req-raw-item');
      item.dataset.reqId = raw.id;
      const row = node('div', 'dsw-req-raw-row');
      row.setAttribute('role', 'row');

      const main = node('div', 'dsw-req-raw-main');
      const title = node('span', 'dsw-req-raw-title', raw.title);
      title.title = raw.title;
      main.append(title);
      if (raw.detail) {
        const detail = node('span', 'dsw-req-raw-detail', raw.detail);
        detail.title = raw.detail;
        main.append(detail);
      }
      row.append(main);

      const proposer = node('span', 'dsw-req-raw-proposer dsw-req-raw-col-proposer');
      const proposerName = node('span', 'dsw-req-raw-proposer-name', raw.proposer || '—');
      proposerName.title = raw.proposer || '';
      proposer.append(proposerName);
      const time = node('span', 'dsw-req-raw-time', formatRawTime(raw.createdAt));
      if (time.textContent) proposer.append(time);
      row.append(proposer);

      const support = node(
        'span',
        `dsw-req-raw-support${raw.supported ? ' is-supported' : ''}`,
        raw.supported ? '已支持' : '未支持',
      );
      if (raw.supportedNote) {
        support.title = raw.supportedNote;
        support.setAttribute('aria-label', `${raw.supported ? '已支持' : '未支持'}：${raw.supportedNote}`);
      }
      const supportCell = node('span', 'dsw-req-raw-col-support');
      supportCell.append(support);
      row.append(supportCell);

      const imported = node(
        'span',
        `dsw-req-raw-imported${raw.importedRequirementIds.length ? ' is-imported' : ''}`,
      );
      if (raw.importedRequirementIds.length) {
        imported.append(
          node('span', 'dsw-req-raw-imported-count', `${raw.importedRequirementIds.length} 条`),
        );
        const linked = state.requirementMap.get(raw.importedRequirementIds[0]);
        const name = node(
          'span',
          'dsw-req-raw-imported-name',
          linked ? linked.title : raw.importedRequirementIds[0],
        );
        imported.append(name);
        imported.title = raw.importedRequirementIds
          .map((id) => {
            const requirement = state.requirementMap.get(id);
            return requirement ? `${requirement.title}（${id}）` : id;
          })
          .join('\n');
      } else {
        imported.textContent = '未导入';
        imported.title = '还没有转入需求';
      }
      const importedCell = node('span', 'dsw-req-raw-col-imported');
      importedCell.append(imported);
      row.append(importedCell);

      item.append(row);
      listBody.append(item);
    });
    list.append(listBody);
    wrap.append(list);
    els.body.append(wrap);
  }

  /* ── render root + events ───────────────────────────────────────────── */

  function render() {
    const active = document.activeElement;
    const searchFocused = Boolean(active && active.matches && active.matches('[data-search]'));
    const caret = searchFocused ? active.selectionStart : null;

    renderTabs();
    renderSteps();
    renderBody();
    renderFoot();

    if (searchFocused) {
      const input = els.body.querySelector('[data-search]');
      if (input) {
        input.focus({ preventScroll: true });
        const position = Math.min(caret === null ? input.value.length : caret, input.value.length);
        try {
          input.setSelectionRange(position, position);
        } catch (error) {
          /* ignore */
        }
      }
    }
  }

  els.steps.addEventListener('click', (event) => {
    const button = event.target.closest('[data-step]');
    if (!button) return;
    const key = button.dataset.step;
    if (key === 'all') {
      state.filters.status = [];
    } else {
      const alone = state.filters.status.length === 1 && state.filters.status[0] === key;
      state.filters.status = alone ? [] : [key];
    }
    closeMenuDom();
    render();
  });

  els.tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    const view = button.dataset.view;
    if (view !== 'list' && view !== 'raws') return;
    state.view = view;
    closeMenuDom();
    render();
  });

  document.addEventListener('click', (event) => {
    if (!state.openMenu) return;
    if (event.target && event.target.closest && event.target.closest('[data-filter-wrap]')) return;
    closeMenuDom();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.openMenu) closeMenuDom();
  });

  loadData();
})();
