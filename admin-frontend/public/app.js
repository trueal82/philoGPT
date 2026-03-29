// ---------------------------------------------------------------------------
// PhiloGPT Admin Panel — client-side application
// ---------------------------------------------------------------------------
'use strict';

let currentToken = null;
let apiBaseUrl = '';

const contentDiv = document.getElementById('content');
const logoutBtn = document.getElementById('logoutBtn');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a DOM element safely (no innerHTML). */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'textContent') {
      node.textContent = v;
    } else if (k === 'htmlFor') {
      node.htmlFor = v;
    } else if (k === 'className') {
      node.className = v;
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'dataset') {
      for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      node.appendChild(document.createTextNode(child));
    } else if (child) {
      node.appendChild(child);
    }
  }
  return node;
}

/** Replace all children of a container with new ones. */
function replaceChildren(container, ...kids) {
  container.textContent = '';
  kids.forEach((k) => {
    if (typeof k === 'string') container.appendChild(document.createTextNode(k));
    else if (k) container.appendChild(k);
  });
}

// ---------------------------------------------------------------------------
// Markdown renderer (for LLM assistant output only)
// ---------------------------------------------------------------------------

/** HTML-escape a raw string to prevent injection. */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert markdown text to safe HTML.
 * Call ONLY on LLM assistant output — escHtml() is applied before any
 * HTML is emitted, so injection via model output is not possible.
 */
function renderMarkdown(text) {
  // Split on fenced code blocks so we can handle them separately
  const segments = text.split(/(```[\w]*\n[\s\S]*?```|```[\s\S]*?```)/g);

  return segments.map((seg, idx) => {
    if (idx % 2 === 1) {
      // Fenced code block — escape content, wrap in <pre><code>
      const inner = seg.replace(/^```[\w]*\n?/, '').replace(/```$/, '');
      return `<pre class="md-pre"><code>${escHtml(inner)}</code></pre>`;
    }
    // Normal segment — escape first, then apply markdown transforms
    return mdProcessLines(escHtml(seg));
  }).join('');
}

function mdProcessLines(s) {
  const applyInline = (t) => t
    // Bold before italic to avoid conflicts
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    // Inline code (content already HTML-escaped)
    .replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');

  const lines = s.split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  for (const line of lines) {
    // Headings: # → <h4>, ## → <h5>, ### → <h6> (sized for chat context)
    const hMatch = line.match(/^(#{1,3}) (.+)$/);
    if (hMatch) {
      closeList();
      const level = hMatch[1].length + 3;
      out.push(`<h${level} class="md-h mt-2 mb-1">${applyInline(hMatch[2])}</h${level}>`);
      continue;
    }
    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      closeList();
      out.push('<hr class="my-1">');
      continue;
    }
    // Unordered list item
    const ulMatch = line.match(/^[-*] (.+)$/);
    if (ulMatch) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul class="mb-1 ps-3">'); inUl = true; }
      out.push(`<li>${applyInline(ulMatch[1])}</li>`);
      continue;
    }
    // Ordered list item
    const olMatch = line.match(/^\d+\. (.+)$/);
    if (olMatch) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol class="mb-1 ps-3">'); inOl = true; }
      out.push(`<li>${applyInline(olMatch[1])}</li>`);
      continue;
    }
    closeList();
    if (line.trim() === '') {
      out.push('<div class="md-gap"></div>');
    } else {
      out.push(`<span>${applyInline(line)}</span><br>`);
    }
  }
  closeList();
  return out.join('');
}

/** Fetch wrapper that auto-handles 401 (expired token). */
async function apiFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
  if (opts.body && typeof opts.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${apiBaseUrl}${path}`, { ...opts, headers });
  if (res.status === 401) {
    handleLogout();
    throw new Error('Session expired');
  }
  return res;
}

function showAlert(type, message) {
  const alert = el('div', { className: `alert alert-${type} alert-dismissible fade show`, role: 'alert' }, [
    message,
    el('button', { type: 'button', className: 'btn-close', 'data-bs-dismiss': 'alert', 'aria-label': 'Close' }),
  ]);
  contentDiv.prepend(alert);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const configRes = await fetch('/config');
    const configData = await configRes.json();
    apiBaseUrl = configData.apiUrl || '';
  } catch (e) {
    console.error('Failed to load runtime config:', e);
  }

  const token = localStorage.getItem('authToken');
  if (token) {
    currentToken = token;
    loadDashboard();
  } else {
    showLogin();
  }

  logoutBtn.addEventListener('click', handleLogout);

  document.querySelectorAll('[data-page]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      loadPage(link.getAttribute('data-page'));
    });
  });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function showLogin() {
  const form = el('form', { id: 'loginForm' }, [
    el('div', { className: 'mb-3' }, [
      el('label', { className: 'form-label', htmlFor: 'loginEmail', textContent: 'Email' }),
      el('input', { type: 'email', className: 'form-control', id: 'loginEmail', required: 'true' }),
    ]),
    el('div', { className: 'mb-3' }, [
      el('label', { className: 'form-label', htmlFor: 'loginPassword', textContent: 'Password' }),
      el('input', { type: 'password', className: 'form-control', id: 'loginPassword', required: 'true' }),
    ]),
    el('button', { type: 'submit', className: 'btn btn-primary w-100', textContent: 'Login' }),
  ]);

  const card = el('div', { className: 'row justify-content-center' }, [
    el('div', { className: 'col-md-6' }, [
      el('div', { className: 'card' }, [
        el('div', { className: 'card-header' }, [
          el('h3', { className: 'text-center', textContent: 'Admin Login' }),
        ]),
        el('div', { className: 'card-body' }, [form]),
      ]),
    ]),
  ]);

  replaceChildren(contentDiv, card);
  form.addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      currentToken = data.token;
      localStorage.setItem('authToken', data.token);
      loadDashboard();
    } else {
      showAlert('danger', data.message || 'Login failed');
    }
  } catch {
    showAlert('danger', 'Unable to reach the server');
  }
}

function handleLogout() {
  localStorage.removeItem('authToken');
  currentToken = null;
  showLogin();
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function loadPage(page) {
  const routes = {
    dashboard: loadDashboard,
    users: loadUsers,
    bots: loadBots,
    'llm-configs': loadLlmConfigs,
    'system-prompt': loadSystemPrompt,
    languages: loadLanguages,
    'user-groups': loadUserGroups,
    subscriptions: loadSubscriptions,
    sessions: loadSessions,
    tools: loadTools,
    'client-memories': loadClientMemories,
    playground: loadPlayground,
  };
  (routes[page] || loadDashboard)();
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function loadDashboard() {
  const userCount = el('p', { className: 'card-text', id: 'userCount', textContent: 'Loading...' });
  const botCount = el('p', { className: 'card-text', id: 'botCount', textContent: 'Loading...' });
  const llmCount = el('p', { className: 'card-text', id: 'llmCount', textContent: 'Loading...' });

  function statCard(bg, title, countEl) {
    return el('div', { className: 'col-md-3' }, [
      el('div', { className: `card text-white ${bg} mb-3` }, [
        el('div', { className: 'card-body' }, [
          el('h5', { className: 'card-title', textContent: title }),
          countEl,
        ]),
      ]),
    ]);
  }

  replaceChildren(
    contentDiv,
    el('div', { className: 'row' }, [
      el('div', { className: 'col-12' }, [
        el('h2', {}, [el('i', { className: 'fas fa-home' }), ' Dashboard']),
        el('div', { className: 'row mt-4' }, [
          statCard('bg-primary', 'Users', userCount),
          statCard('bg-success', 'Bots', botCount),
          statCard('bg-info', 'LLM Configs', llmCount),
          statCard('bg-warning', 'Active Sessions', el('p', { className: 'card-text', textContent: '0' })),
        ]),
      ]),
    ]),
  );

  loadDashboardData(userCount, botCount, llmCount);
}

async function loadDashboardData(userEl, botEl, llmEl) {
  try {
    const [usersRes, botsRes, llmRes] = await Promise.all([
      apiFetch('/api/admin/users'),
      apiFetch('/api/bots'),
      apiFetch('/api/admin/llm-configs'),
    ]);
    const [usersData, botsData, llmData] = await Promise.all([
      usersRes.json(),
      botsRes.json(),
      llmRes.json(),
    ]);
    userEl.textContent = usersData.users?.length ?? 0;
    botEl.textContent = botsData.bots?.length ?? 0;
    llmEl.textContent = llmData.configs?.length ?? 0;
  } catch (err) {
    console.error('Dashboard data error:', err);
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
async function loadUsers() {
  try {
    const res = await apiFetch('/api/admin/users');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading users' }));
      return;
    }

    const tbody = el('tbody');
    data.users.forEach((user) => {
      const badgeClass = user.role === 'admin' ? 'bg-danger' : 'bg-secondary';
      const lockBadge = user.isLocked
        ? el('span', { className: 'badge bg-warning text-dark', textContent: 'Locked' })
        : el('span', { className: 'badge bg-success', textContent: 'Active' });
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: user.email }),
          el('td', {}, [el('span', { className: `badge ${badgeClass}`, textContent: user.role })]),
          el('td', {}, [lockBadge]),
          el('td', { textContent: user.languageCode || 'en-us' }),
          el('td', { textContent: new Date(user.createdAt).toLocaleDateString() }),
          el('td', {}, [
            el('button', {
              className: 'btn btn-sm btn-outline-primary me-1',
              onClick: () => editUser(user),
            }, [el('i', { className: 'fas fa-edit' }), ' Edit']),
            el('button', {
              className: 'btn btn-sm btn-outline-danger',
              onClick: () => deleteUser(user._id),
            }, [el('i', { className: 'fas fa-trash' }), ' Delete']),
          ]),
        ]),
      );
    });

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-users' }), ' Users Management']),
      ]),
      el('div', { className: 'table-responsive' }, [
        el('table', { className: 'table table-striped' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { textContent: 'Email' }),
              el('th', { textContent: 'Role' }),
              el('th', { textContent: 'Status' }),
              el('th', { textContent: 'Language' }),
              el('th', { textContent: 'Created' }),
              el('th', { textContent: 'Actions' }),
            ]),
          ]),
          tbody,
        ]),
      ]),
    );
  } catch (err) {
    console.error('loadUsers error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading users' }));
  }
}

async function editUser(user) {
  const modal = document.getElementById('userModal');
  const bsModal = new bootstrap.Modal(modal);

  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('userEmail').value = user.email;
  document.getElementById('userRole').value = user.role;

  // Populate language dropdown
  const langSelect = document.getElementById('userLanguageCode');
  langSelect.textContent = '';
  try {
    const langRes = await apiFetch('/api/admin/languages');
    const langData = await langRes.json();
    (langData.languages || []).forEach((lang) => {
      langSelect.appendChild(el('option', { value: lang.code, textContent: `${lang.name} (${lang.code})` }));
    });
  } catch { /* ignore */ }
  langSelect.value = user.languageCode || 'en-us';

  // Populate user group dropdown
  const ugSelect = document.getElementById('userGroupId');
  ugSelect.textContent = '';
  ugSelect.appendChild(el('option', { value: '', textContent: '-- None --' }));
  try {
    const ugRes = await apiFetch('/api/admin/user-groups');
    const ugData = await ugRes.json();
    (ugData.userGroups || []).forEach((ug) => {
      ugSelect.appendChild(el('option', { value: ug._id, textContent: ug.name }));
    });
  } catch { /* ignore */ }
  ugSelect.value = user.userGroupId || '';

  // Populate subscription dropdown
  const subSelect = document.getElementById('userSubscriptionId');
  subSelect.textContent = '';
  subSelect.appendChild(el('option', { value: '', textContent: '-- None --' }));
  try {
    const subRes = await apiFetch('/api/admin/subscriptions');
    const subData = await subRes.json();
    (subData.subscriptions || []).forEach((sub) => {
      subSelect.appendChild(el('option', { value: sub._id, textContent: sub.name }));
    });
  } catch { /* ignore */ }
  subSelect.value = user.subscriptionId || '';

  // Lock section
  const lockStatusDiv = document.getElementById('userLockStatus');
  const lockReasonGroup = document.getElementById('userLockReasonGroup');
  const lockReasonInput = document.getElementById('userLockReason');
  const toggleLockBtn = document.getElementById('toggleLockBtn');

  lockStatusDiv.textContent = '';
  if (user.isLocked) {
    lockStatusDiv.appendChild(el('span', { className: 'badge bg-warning text-dark', textContent: 'Locked' }));
    if (user.lockedAt) {
      lockStatusDiv.appendChild(el('small', { className: 'ms-2 text-muted', textContent: `since ${new Date(user.lockedAt).toLocaleString()}` }));
    }
    if (user.lockedReason) {
      lockStatusDiv.appendChild(el('div', { className: 'small text-muted mt-1', textContent: `Reason: ${user.lockedReason}` }));
    }
    lockReasonGroup.style.display = 'none';
    toggleLockBtn.textContent = 'Unlock';
    toggleLockBtn.className = 'btn btn-success btn-sm';
  } else {
    lockStatusDiv.appendChild(el('span', { className: 'badge bg-success', textContent: 'Active' }));
    lockReasonGroup.style.display = 'block';
    lockReasonInput.value = '';
    toggleLockBtn.textContent = 'Lock';
    toggleLockBtn.className = 'btn btn-warning btn-sm';
  }

  const lockBtn = toggleLockBtn;
  lockBtn.replaceWith(lockBtn.cloneNode(true));
  document.getElementById('toggleLockBtn').addEventListener('click', async () => {
    if (user.isLocked) {
      const res = await apiFetch(`/api/admin/users/${user._id}/unlock`, { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        bsModal.hide();
        loadUsers();
        showAlert('success', d.message || 'User unlocked');
      } else {
        showAlert('danger', 'Error unlocking user');
      }
    } else {
      const reason = document.getElementById('userLockReason').value.trim();
      const res = await apiFetch(`/api/admin/users/${user._id}/lock`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        const d = await res.json();
        bsModal.hide();
        loadUsers();
        showAlert('success', d.message || 'User locked');
      } else {
        showAlert('danger', 'Error locking user');
      }
    }
  });

  const saveBtn = document.getElementById('saveUser');
  const handler = async () => {
    const payload = {
      role: document.getElementById('userRole').value,
      languageCode: document.getElementById('userLanguageCode').value,
      userGroupId: document.getElementById('userGroupId').value || null,
      subscriptionId: document.getElementById('userSubscriptionId').value || null,
    };
    try {
      const res = await apiFetch(`/api/admin/users/${user._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        bsModal.hide();
        loadUsers();
      } else {
        const d = await res.json();
        showAlert('danger', d.message || 'Error updating user');
      }
    } catch {
      showAlert('danger', 'Error updating user');
    }
  };
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  document.getElementById('saveUser').addEventListener('click', handler);
  bsModal.show();
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  try {
    const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (res.ok) loadUsers();
    else showAlert('danger', 'Error deleting user');
  } catch {
    showAlert('danger', 'Error deleting user');
  }
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------
async function loadBots() {
  try {
    const res = await apiFetch('/api/bots');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading bots' }));
      return;
    }

    const tbody = el('tbody');
    data.bots.forEach((bot) => {
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: bot.avatar || '🧠' }),
          el('td', { textContent: bot.name || '' }),
          el('td', { textContent: bot.description || '' }),
          el('td', {}, [
            el('button', {
              className: 'btn btn-sm btn-outline-primary me-1',
              onClick: () => showBotEditor(bot),
            }, [el('i', { className: 'fas fa-edit' }), ' Edit']),
            el('button', {
              className: 'btn btn-sm btn-outline-danger',
              onClick: () => deleteBot(bot._id),
            }, [el('i', { className: 'fas fa-trash' }), ' Delete']),
          ]),
        ]),
      );
    });

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-robot' }), ' Bot Management']),
        el('button', {
          className: 'btn btn-primary',
          onClick: () => showBotEditor(null),
        }, [el('i', { className: 'fas fa-plus' }), ' Add Bot']),
      ]),
      el('div', { className: 'table-responsive' }, [
        el('table', { className: 'table table-striped' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { textContent: 'Avatar' }),
              el('th', { textContent: 'Name' }),
              el('th', { textContent: 'Description' }),
              el('th', { textContent: 'Actions' }),
            ]),
          ]),
          tbody,
        ]),
      ]),
    );
  } catch (err) {
    console.error('loadBots error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading bots' }));
  }
}

// ---------------------------------------------------------------------------
// Bot Editor — unified full-page view with General + per-language tabs
// ---------------------------------------------------------------------------

async function showBotEditor(bot) {
  // Fetch languages, locales, subscriptions, LLM configs in parallel
  let languages = [];
  let existingLocales = [];
  let subscriptions = [];
  let llmConfigs = [];

  try {
    const fetches = [
      apiFetch('/api/admin/languages'),
      apiFetch('/api/admin/subscriptions'),
      apiFetch('/api/admin/llm-configs'),
    ];
    if (bot) {
      fetches.push(apiFetch(`/api/admin/bot-locales/${encodeURIComponent(bot._id)}`));
    }
    const responses = await Promise.all(fetches);
    const [langData, subData, llmData] = await Promise.all(responses.slice(0, 3).map((r) => r.json()));
    languages = (langData.languages || []).filter((l) => l.active);
    subscriptions = subData.subscriptions || [];
    llmConfigs = llmData.configs || [];
    if (bot && responses[3]) {
      const locData = await responses[3].json();
      existingLocales = locData.locales || [];
    }
  } catch (err) {
    console.error('showBotEditor fetch error:', err);
    showAlert('danger', 'Error loading editor data');
    return;
  }

  const localeMap = {};
  existingLocales.forEach((loc) => { localeMap[loc.languageCode] = loc; });

  // --- Build tabs ---
  const navTabs = el('ul', { className: 'nav nav-tabs', role: 'tablist' });
  const tabContent = el('div', { className: 'tab-content pt-3' });

  // ===== General tab =====
  const generalTabId = 'bot-tab-general';
  const generalPaneId = 'bot-pane-general';
  navTabs.appendChild(
    el('li', { className: 'nav-item', role: 'presentation' }, [
      el('a', {
        className: 'nav-link active',
        id: generalTabId,
        href: `#${generalPaneId}`,
        role: 'tab',
        'aria-controls': generalPaneId,
        'aria-selected': 'true',
        'data-bs-toggle': 'tab',
      }, [el('i', { className: 'fas fa-cog' }), ' General']),
    ]),
  );

  // Avatar
  const avatarInput = el('input', { type: 'text', className: 'form-control', id: 'botEditorAvatar' });
  avatarInput.value = bot?.avatar || '';

  // Subscriptions multi-select
  const subSelect = el('select', { className: 'form-control', id: 'botEditorSubs', multiple: 'multiple', size: '4' });
  const selectedSubIds = (bot?.availableToSubscriptionIds || []).map(String);
  subscriptions.forEach((sub) => {
    const opt = el('option', { value: sub._id, textContent: sub.name });
    if (selectedSubIds.includes(sub._id)) opt.selected = true;
    subSelect.appendChild(opt);
  });

  // LLM config select
  const llmSelect = el('select', { className: 'form-control', id: 'botEditorLlm' });
  llmSelect.appendChild(el('option', { value: '', textContent: '— Select LLM Config —' }));
  const currentLlm = bot?.llmConfigId ? String(typeof bot.llmConfigId === 'object' ? bot.llmConfigId._id : bot.llmConfigId) : '';
  llmConfigs.forEach((cfg) => {
    const opt = el('option', { value: cfg._id, textContent: `${cfg.name} (${cfg.provider} / ${cfg.model})` });
    if (cfg._id === currentLlm) opt.selected = true;
    llmSelect.appendChild(opt);
  });

  const generalPane = el('div', {
    className: 'tab-pane fade show active',
    id: generalPaneId,
    role: 'tabpanel',
    'aria-labelledby': generalTabId,
  }, [
    el('div', { className: 'mb-3' }, [
      el('label', { className: 'form-label', textContent: 'Avatar' }),
      avatarInput,
    ]),
    el('div', { className: 'mb-3' }, [
      el('label', { className: 'form-label', textContent: 'Available to Subscriptions' }),
      subSelect,
      el('small', { className: 'text-muted', textContent: 'Hold Ctrl/Cmd to select multiple' }),
    ]),
    el('div', { className: 'mb-3' }, [
      el('label', { className: 'form-label', textContent: 'LLM Configuration' }),
      llmSelect,
      el('small', { className: 'text-muted', textContent: 'Required for the bot to produce responses' }),
    ]),
  ]);
  tabContent.appendChild(generalPane);

  // ===== Per-language tabs =====
  const localizableFields = [
    { key: 'name', label: 'Name', type: 'input' },
    { key: 'description', label: 'Description', type: 'textarea', rows: 3 },
    { key: 'personality', label: 'Personality', type: 'textarea', rows: 3 },
    { key: 'systemPrompt', label: 'System Prompt', type: 'textarea', rows: 6 },
  ];

  languages.forEach((lang) => {
    const tabId = `bot-tab-${lang.code}`;
    const paneId = `bot-pane-${lang.code}`;
    const existing = localeMap[lang.code];

    const navLink = el('a', {
      className: `nav-link${existing ? ' fw-bold' : ''}`,
      id: tabId,
      href: `#${paneId}`,
      role: 'tab',
      'aria-controls': paneId,
      'aria-selected': 'false',
      'data-bs-toggle': 'tab',
    }, [
      el('i', { className: 'fas fa-language' }),
      ` ${lang.nativeName} (${lang.code})`,
    ]);
    navTabs.appendChild(el('li', { className: 'nav-item', role: 'presentation' }, [navLink]));

    const fieldElements = [];
    localizableFields.forEach((f) => {
      const inputId = `bot-${lang.code}-${f.key}`;
      // For existing bots: show locale value if it exists, otherwise empty
      // For new bots: fields start empty
      const value = existing?.[f.key] ?? '';
      const label = el('label', { className: 'form-label', htmlFor: inputId, textContent: f.label });
      let input;
      if (f.type === 'textarea') {
        input = el('textarea', { className: 'form-control', id: inputId, rows: String(f.rows || 3) });
        input.value = value;
      } else {
        input = el('input', { type: 'text', className: 'form-control', id: inputId });
        input.value = value;
      }
      fieldElements.push(el('div', { className: 'mb-3' }, [label, input]));
    });

    const pane = el('div', {
      className: 'tab-pane fade',
      id: paneId,
      role: 'tabpanel',
      'aria-labelledby': tabId,
    }, fieldElements);
    tabContent.appendChild(pane);
  });

  // ===== Save & Back buttons =====
  const saveAllBtn = el('button', {
    className: 'btn btn-primary me-2',
    onClick: () => saveBotAll(bot?._id, languages, localizableFields),
  }, [el('i', { className: 'fas fa-save' }), ' Save Everything']);

  const backBtn = el('button', {
    className: 'btn btn-outline-secondary',
    onClick: () => loadBots(),
  }, [el('i', { className: 'fas fa-arrow-left' }), ' Back to Bots']);

  replaceChildren(
    contentDiv,
    el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
      el('h2', {}, [
        el('i', { className: 'fas fa-robot' }),
        bot ? ` Edit Bot — ${bot.name || bot.avatar || bot._id}` : ' Add New Bot',
      ]),
      el('div', {}, [saveAllBtn, backBtn]),
    ]),
    navTabs,
    tabContent,
  );
}

async function saveBotAll(botId, languages, localizableFields) {
  // Collect locale data from the first language tab to validate
  const firstLang = languages[0];
  if (!firstLang) {
    showAlert('warning', 'No languages configured');
    return;
  }

  const firstSystemPrompt = document.getElementById(`bot-${firstLang.code}-systemPrompt`)?.value.trim() || '';
  const firstName = document.getElementById(`bot-${firstLang.code}-name`)?.value.trim() || '';

  if (!firstName || !firstSystemPrompt) {
    showAlert('warning', `Name and System Prompt are required on the ${firstLang.nativeName} tab`);
    return;
  }

  const subSelect = document.getElementById('botEditorSubs');
  const availableToSubscriptionIds = Array.from(subSelect.selectedOptions).map((o) => o.value);

  const botPayload = {
    avatar: document.getElementById('botEditorAvatar').value.trim(),
    availableToSubscriptionIds,
    llmConfigId: document.getElementById('botEditorLlm').value || undefined,
  };

  try {
    // Save or create the bot
    const url = botId ? `/api/bots/${botId}` : '/api/bots';
    const method = botId ? 'PUT' : 'POST';
    const botRes = await apiFetch(url, { method, body: JSON.stringify(botPayload) });
    if (!botRes.ok) {
      const d = await botRes.json();
      showAlert('danger', d.message || 'Error saving bot');
      return;
    }
    const botData = await botRes.json();
    const savedBotId = botData.bot?._id || botId;

    // Save locales for each language that has content
    const localePromises = [];
    for (const lang of languages) {
      const localePayload = {};
      let hasContent = false;
      for (const f of localizableFields) {
        const val = document.getElementById(`bot-${lang.code}-${f.key}`)?.value.trim() || '';
        localePayload[f.key] = val;
        if (val) hasContent = true;
      }
      if (hasContent && localePayload.systemPrompt) {
        localePromises.push(
          apiFetch(
            `/api/admin/bot-locales/${encodeURIComponent(savedBotId)}/${encodeURIComponent(lang.code)}`,
            { method: 'PUT', body: JSON.stringify(localePayload) },
          ),
        );
      }
    }
    await Promise.all(localePromises);
    showAlert('success', 'Bot and locales saved successfully');
    loadBots();
  } catch {
    showAlert('danger', 'Error saving bot');
  }
}

async function deleteBot(botId) {
  if (!confirm('Are you sure you want to delete this bot?')) return;
  try {
    const res = await apiFetch(`/api/bots/${botId}`, { method: 'DELETE' });
    if (res.ok) loadBots();
    else showAlert('danger', 'Error deleting bot');
  } catch {
    showAlert('danger', 'Error deleting bot');
  }
}

// ---------------------------------------------------------------------------
// LLM Configs
// ---------------------------------------------------------------------------
async function loadLlmConfigs() {
  try {
    const res = await apiFetch('/api/admin/llm-configs');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading LLM configs' }));
      return;
    }

    const tbody = el('tbody');
    data.configs.forEach((config) => {
      const toolsBadge = config.supportsTools
        ? el('span', { className: 'badge bg-info', textContent: 'Yes' })
        : el('span', { className: 'badge bg-secondary', textContent: 'No' });
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: config.name }),
          el('td', { textContent: config.provider }),
          el('td', { textContent: config.model || 'N/A' }),
          el('td', {}, [toolsBadge]),
          el('td', {}, [
            el('button', {
              className: 'btn btn-sm btn-outline-primary me-1',
              onClick: () => showLlmConfigModal(config),
            }, [el('i', { className: 'fas fa-edit' }), ' Edit']),
            el('button', {
              className: 'btn btn-sm btn-outline-danger',
              onClick: () => deleteLlmConfig(config._id),
            }, [el('i', { className: 'fas fa-trash' }), ' Delete']),
          ]),
        ]),
      );
    });

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-cogs' }), ' LLM Configurations']),
        el('button', {
          className: 'btn btn-primary',
          onClick: () => showLlmConfigModal(),
        }, [el('i', { className: 'fas fa-plus' }), ' Add Config']),
      ]),
      el('div', { className: 'table-responsive' }, [
        el('table', { className: 'table table-striped' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { textContent: 'Name' }),
              el('th', { textContent: 'Provider' }),
              el('th', { textContent: 'Model' }),
              el('th', { textContent: 'Tools' }),
              el('th', { textContent: 'Actions' }),
            ]),
          ]),
          tbody,
        ]),
      ]),
    );
  } catch (err) {
    console.error('loadLlmConfigs error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading LLM configs' }));
  }
}

function showLlmConfigModal(config = null) {
  const modal = document.getElementById('llmConfigModal');
  const bsModal = new bootstrap.Modal(modal);

  document.getElementById('llmConfigModalTitle').textContent = config ? 'Edit LLM Config' : 'Add New LLM Config';
  document.getElementById('llmConfigName').value = config?.name || '';
  document.getElementById('llmConfigProvider').value = config?.provider || 'openai';
  document.getElementById('llmConfigApiKey').value = '';
  document.getElementById('llmConfigApiUrl').value = config?.apiUrl || '';
  document.getElementById('llmConfigModel').value = config?.model || '';
  document.getElementById('llmConfigTemperature').value = config?.temperature ?? '';
  document.getElementById('llmConfigMaxTokens').value = config?.maxTokens ?? '';
  document.getElementById('llmConfigSupportsTools').checked = config?.supportsTools || false;

  const saveBtn = document.getElementById('saveLlmConfig');
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  document.getElementById('saveLlmConfig').addEventListener('click', () =>
    saveLlmConfig(config?._id, bsModal),
  );
  bsModal.show();
}

async function saveLlmConfig(configId, bsModal) {
  const payload = {
    name: document.getElementById('llmConfigName').value.trim(),
    provider: document.getElementById('llmConfigProvider').value,
    apiUrl: document.getElementById('llmConfigApiUrl').value.trim(),
    model: document.getElementById('llmConfigModel').value.trim(),
  };
  const apiKey = document.getElementById('llmConfigApiKey').value;
  if (apiKey) payload.apiKey = apiKey;
  const temp = document.getElementById('llmConfigTemperature').value;
  if (temp !== '') payload.temperature = parseFloat(temp);
  const maxTok = document.getElementById('llmConfigMaxTokens').value;
  if (maxTok !== '') payload.maxTokens = parseInt(maxTok, 10);
  payload.supportsTools = document.getElementById('llmConfigSupportsTools').checked;

  if (!payload.name || !payload.provider) {
    showAlert('warning', 'Name and Provider are required');
    return;
  }

  try {
    const url = configId ? `/api/admin/llm-configs/${configId}` : '/api/admin/llm-configs';
    const method = configId ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (res.ok) {
      bsModal.hide();
      loadLlmConfigs();
    } else {
      const d = await res.json();
      showAlert('danger', d.message || 'Error saving LLM config');
    }
  } catch {
    showAlert('danger', 'Error saving LLM config');
  }
}

async function deleteLlmConfig(configId) {
  if (!confirm('Are you sure you want to delete this LLM configuration?')) return;
  try {
    const res = await apiFetch(`/api/admin/llm-configs/${configId}`, { method: 'DELETE' });
    if (res.ok) loadLlmConfigs();
    else showAlert('danger', 'Error deleting LLM configuration');
  } catch {
    showAlert('danger', 'Error deleting LLM configuration');
  }
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------
async function loadSystemPrompt() {
  try {
    const res = await apiFetch('/api/admin/system-prompt');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading system prompt' }));
      return;
    }

    const textarea = el('textarea', {
      className: 'form-control',
      id: 'systemPromptText',
      rows: '10',
    });
    textarea.value = data.prompt?.content || '';

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-comment' }), ' System Prompt']),
      ]),
      el('div', { className: 'card' }, [
        el('div', { className: 'card-body' }, [
          textarea,
          el('div', { className: 'mt-3' }, [
            el('button', {
              className: 'btn btn-primary',
              onClick: saveSystemPrompt,
              textContent: 'Save System Prompt',
            }),
          ]),
        ]),
      ]),
    );
  } catch (err) {
    console.error('loadSystemPrompt error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading system prompt' }));
  }
}

async function saveSystemPrompt() {
  const content = document.getElementById('systemPromptText').value;
  try {
    const res = await apiFetch('/api/admin/system-prompt', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      showAlert('success', 'System prompt saved successfully');
    } else {
      const d = await res.json();
      showAlert('danger', d.message || 'Error saving system prompt');
    }
  } catch {
    showAlert('danger', 'Error saving system prompt');
  }
}

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------
async function loadLanguages() {
  try {
    const res = await apiFetch('/api/admin/languages');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading languages' }));
      return;
    }

    const tbody = el('tbody');
    (data.languages || []).forEach((lang) => {
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: lang.code }),
          el('td', { textContent: lang.name }),
          el('td', { textContent: lang.nativeName }),
          el('td', { textContent: lang.sortOrder }),
          el('td', {}, [
            el('span', {
              className: `badge ${lang.active ? 'bg-success' : 'bg-secondary'}`,
              textContent: lang.active ? 'Active' : 'Inactive',
            }),
          ]),
          el('td', {}, [
            el('button', {
              className: 'btn btn-sm btn-outline-primary me-1',
              onClick: () => showLanguageModal(lang),
            }, [el('i', { className: 'fas fa-edit' }), ' Edit']),
            el('button', {
              className: 'btn btn-sm btn-outline-danger',
              onClick: () => deleteLanguage(lang._id),
            }, [el('i', { className: 'fas fa-trash' }), ' Delete']),
          ]),
        ]),
      );
    });

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-language' }), ' Languages']),
        el('button', {
          className: 'btn btn-primary',
          onClick: () => showLanguageModal(),
        }, [el('i', { className: 'fas fa-plus' }), ' Add Language']),
      ]),
      el('div', { className: 'table-responsive' }, [
        el('table', { className: 'table table-striped' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { textContent: 'Code' }),
              el('th', { textContent: 'Name' }),
              el('th', { textContent: 'Native Name' }),
              el('th', { textContent: 'Sort Order' }),
              el('th', { textContent: 'Status' }),
              el('th', { textContent: 'Actions' }),
            ]),
          ]),
          tbody,
        ]),
      ]),
    );
  } catch (err) {
    console.error('loadLanguages error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading languages' }));
  }
}

function showLanguageModal(lang = null) {
  const modal = document.getElementById('languageModal');
  const bsModal = new bootstrap.Modal(modal);

  document.getElementById('languageModalTitle').textContent = lang ? 'Edit Language' : 'Add New Language';
  document.getElementById('languageCode').value = lang?.code || '';
  document.getElementById('languageName').value = lang?.name || '';
  document.getElementById('languageNativeName').value = lang?.nativeName || '';
  document.getElementById('languageSortOrder').value = lang?.sortOrder ?? 0;
  document.getElementById('languageActive').checked = lang?.active !== false;

  const saveBtn = document.getElementById('saveLanguage');
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  document.getElementById('saveLanguage').addEventListener('click', () => saveLanguage(lang?._id, bsModal));
  bsModal.show();
}

async function saveLanguage(langId, bsModal) {
  const payload = {
    code: document.getElementById('languageCode').value.trim(),
    name: document.getElementById('languageName').value.trim(),
    nativeName: document.getElementById('languageNativeName').value.trim(),
    sortOrder: parseInt(document.getElementById('languageSortOrder').value, 10) || 0,
    active: document.getElementById('languageActive').checked,
  };
  if (!payload.code || !payload.name || !payload.nativeName) {
    showAlert('warning', 'Code, Name, and Native Name are required');
    return;
  }
  try {
    const url = langId ? `/api/admin/languages/${langId}` : '/api/admin/languages';
    const method = langId ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (res.ok) {
      bsModal.hide();
      loadLanguages();
    } else {
      const d = await res.json();
      showAlert('danger', d.message || 'Error saving language');
    }
  } catch {
    showAlert('danger', 'Error saving language');
  }
}

async function deleteLanguage(langId) {
  if (!confirm('Are you sure you want to delete this language?')) return;
  try {
    const res = await apiFetch(`/api/admin/languages/${langId}`, { method: 'DELETE' });
    if (res.ok) loadLanguages();
    else showAlert('danger', 'Error deleting language');
  } catch {
    showAlert('danger', 'Error deleting language');
  }
}

// ---------------------------------------------------------------------------
// User Groups
// ---------------------------------------------------------------------------
async function loadUserGroups() {
  try {
    const res = await apiFetch('/api/admin/user-groups');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading user groups' }));
      return;
    }

    const tbody = el('tbody');
    (data.userGroups || []).forEach((ug) => {
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: ug.name }),
          el('td', { textContent: ug.description || '' }),
          el('td', {}, [
            el('span', {
              className: `badge ${ug.active ? 'bg-success' : 'bg-secondary'}`,
              textContent: ug.active ? 'Active' : 'Inactive',
            }),
          ]),
          el('td', {}, [
            el('button', {
              className: 'btn btn-sm btn-outline-primary me-1',
              onClick: () => showUserGroupModal(ug),
            }, [el('i', { className: 'fas fa-edit' }), ' Edit']),
            el('button', {
              className: 'btn btn-sm btn-outline-danger',
              onClick: () => deleteUserGroup(ug._id),
            }, [el('i', { className: 'fas fa-trash' }), ' Delete']),
          ]),
        ]),
      );
    });

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-layer-group' }), ' User Groups']),
        el('button', {
          className: 'btn btn-primary',
          onClick: () => showUserGroupModal(),
        }, [el('i', { className: 'fas fa-plus' }), ' Add User Group']),
      ]),
      el('div', { className: 'table-responsive' }, [
        el('table', { className: 'table table-striped' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { textContent: 'Name' }),
              el('th', { textContent: 'Description' }),
              el('th', { textContent: 'Status' }),
              el('th', { textContent: 'Actions' }),
            ]),
          ]),
          tbody,
        ]),
      ]),
    );
  } catch (err) {
    console.error('loadUserGroups error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading user groups' }));
  }
}

function showUserGroupModal(ug = null) {
  const modal = document.getElementById('userGroupModal');
  const bsModal = new bootstrap.Modal(modal);

  document.getElementById('userGroupModalTitle').textContent = ug ? 'Edit User Group' : 'Add New User Group';
  document.getElementById('userGroupName').value = ug?.name || '';
  document.getElementById('userGroupDescription').value = ug?.description || '';
  document.getElementById('userGroupActive').checked = ug?.active !== false;

  const saveBtn = document.getElementById('saveUserGroup');
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  document.getElementById('saveUserGroup').addEventListener('click', () => saveUserGroup(ug?._id, bsModal));
  bsModal.show();
}

async function saveUserGroup(ugId, bsModal) {
  const payload = {
    name: document.getElementById('userGroupName').value.trim(),
    description: document.getElementById('userGroupDescription').value.trim(),
    active: document.getElementById('userGroupActive').checked,
  };
  if (!payload.name) {
    showAlert('warning', 'Name is required');
    return;
  }
  try {
    const url = ugId ? `/api/admin/user-groups/${ugId}` : '/api/admin/user-groups';
    const method = ugId ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (res.ok) {
      bsModal.hide();
      loadUserGroups();
    } else {
      const d = await res.json();
      showAlert('danger', d.message || 'Error saving user group');
    }
  } catch {
    showAlert('danger', 'Error saving user group');
  }
}

async function deleteUserGroup(ugId) {
  if (!confirm('Are you sure you want to delete this user group?')) return;
  try {
    const res = await apiFetch(`/api/admin/user-groups/${ugId}`, { method: 'DELETE' });
    if (res.ok) loadUserGroups();
    else showAlert('danger', 'Error deleting user group');
  } catch {
    showAlert('danger', 'Error deleting user group');
  }
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
async function loadSubscriptions() {
  try {
    const res = await apiFetch('/api/admin/subscriptions');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading subscriptions' }));
      return;
    }

    const tbody = el('tbody');
    (data.subscriptions || []).forEach((sub) => {
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: sub.name }),
          el('td', { textContent: sub.description || '' }),
          el('td', { textContent: (sub.featureFlags || []).join(', ') }),
          el('td', {}, [
            el('span', {
              className: `badge ${sub.active ? 'bg-success' : 'bg-secondary'}`,
              textContent: sub.active ? 'Active' : 'Inactive',
            }),
          ]),
          el('td', {}, [
            el('button', {
              className: 'btn btn-sm btn-outline-primary me-1',
              onClick: () => showSubscriptionModal(sub),
            }, [el('i', { className: 'fas fa-edit' }), ' Edit']),
            el('button', {
              className: 'btn btn-sm btn-outline-danger',
              onClick: () => deleteSubscription(sub._id),
            }, [el('i', { className: 'fas fa-trash' }), ' Delete']),
          ]),
        ]),
      );
    });

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-tags' }), ' Subscriptions']),
        el('button', {
          className: 'btn btn-primary',
          onClick: () => showSubscriptionModal(),
        }, [el('i', { className: 'fas fa-plus' }), ' Add Subscription']),
      ]),
      el('div', { className: 'table-responsive' }, [
        el('table', { className: 'table table-striped' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { textContent: 'Name' }),
              el('th', { textContent: 'Description' }),
              el('th', { textContent: 'Feature Flags' }),
              el('th', { textContent: 'Status' }),
              el('th', { textContent: 'Actions' }),
            ]),
          ]),
          tbody,
        ]),
      ]),
    );
  } catch (err) {
    console.error('loadSubscriptions error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading subscriptions' }));
  }
}

function showSubscriptionModal(sub = null) {
  const modal = document.getElementById('subscriptionModal');
  const bsModal = new bootstrap.Modal(modal);

  document.getElementById('subscriptionModalTitle').textContent = sub ? 'Edit Subscription' : 'Add New Subscription';
  document.getElementById('subscriptionName').value = sub?.name || '';
  document.getElementById('subscriptionDescription').value = sub?.description || '';
  document.getElementById('subscriptionFeatureFlags').value = (sub?.featureFlags || []).join(', ');
  document.getElementById('subscriptionActive').checked = sub?.active !== false;

  const saveBtn = document.getElementById('saveSubscription');
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  document.getElementById('saveSubscription').addEventListener('click', () => saveSubscription(sub?._id, bsModal));
  bsModal.show();
}

async function saveSubscription(subId, bsModal) {
  const flagsStr = document.getElementById('subscriptionFeatureFlags').value.trim();
  const featureFlags = flagsStr ? flagsStr.split(',').map((f) => f.trim()).filter(Boolean) : [];
  const payload = {
    name: document.getElementById('subscriptionName').value.trim(),
    description: document.getElementById('subscriptionDescription').value.trim(),
    active: document.getElementById('subscriptionActive').checked,
    featureFlags,
  };
  if (!payload.name) {
    showAlert('warning', 'Name is required');
    return;
  }
  try {
    const url = subId ? `/api/admin/subscriptions/${subId}` : '/api/admin/subscriptions';
    const method = subId ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (res.ok) {
      bsModal.hide();
      loadSubscriptions();
    } else {
      const d = await res.json();
      showAlert('danger', d.message || 'Error saving subscription');
    }
  } catch {
    showAlert('danger', 'Error saving subscription');
  }
}

async function deleteSubscription(subId) {
  if (!confirm('Are you sure you want to delete this subscription?')) return;
  try {
    const res = await apiFetch(`/api/admin/subscriptions/${subId}`, { method: 'DELETE' });
    if (res.ok) loadSubscriptions();
    else showAlert('danger', 'Error deleting subscription');
  } catch {
    showAlert('danger', 'Error deleting subscription');
  }
}

// ---------------------------------------------------------------------------
// Sessions (admin — all users)
// ---------------------------------------------------------------------------
async function loadSessions() {
  try {
    const res = await apiFetch('/api/admin/sessions');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading sessions' }));
      return;
    }

    const tbody = el('tbody');
    (data.sessions || []).forEach((s) => {
      const userEmail = s.userId?.email || 'Unknown';
      const botName = s.botId?.name || 'Unknown';
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: userEmail }),
          el('td', { textContent: botName }),
          el('td', { textContent: s.title || '(untitled)' }),
          el('td', { textContent: s.lockedLanguageCode || '' }),
          el('td', { textContent: String(s.messageCount || 0) }),
          el('td', { textContent: new Date(s.createdAt).toLocaleString() }),
          el('td', {}, [
            el('button', {
              className: 'btn btn-sm btn-outline-primary me-1',
              onClick: () => viewSessionMessages(s._id, `${userEmail} — ${botName}`),
            }, [el('i', { className: 'fas fa-eye' }), ' View']),
            el('button', {
              className: 'btn btn-sm btn-outline-danger',
              onClick: () => deleteSession(s._id),
            }, [el('i', { className: 'fas fa-trash' }), ' Delete']),
          ]),
        ]),
      );
    });

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-comments' }), ' Sessions']),
      ]),
      el('div', { className: 'table-responsive' }, [
        el('table', { className: 'table table-striped' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { textContent: 'User' }),
              el('th', { textContent: 'Bot' }),
              el('th', { textContent: 'Title' }),
              el('th', { textContent: 'Language' }),
              el('th', { textContent: 'Messages' }),
              el('th', { textContent: 'Created' }),
              el('th', { textContent: 'Actions' }),
            ]),
          ]),
          tbody,
        ]),
      ]),
    );
  } catch (err) {
    console.error('loadSessions error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading sessions' }));
  }
}

async function viewSessionMessages(sessionId, title) {
  try {
    const res = await apiFetch(`/api/admin/sessions/${sessionId}/messages`);
    const data = await res.json();
    if (!res.ok) {
      showAlert('danger', 'Error loading messages');
      return;
    }

    const modal = document.getElementById('sessionMessagesModal');
    const bsModal = new bootstrap.Modal(modal);
    document.getElementById('sessionMessagesModalTitle').textContent = title || 'Session Messages';

    const body = document.getElementById('sessionMessagesBody');
    body.textContent = '';

    if (!data.messages || data.messages.length === 0) {
      body.appendChild(el('p', { className: 'text-muted', textContent: 'No messages in this session.' }));
    } else {
      data.messages.forEach((m) => {
        const roleClass = m.role === 'user' ? 'bg-primary' : m.role === 'assistant' ? 'bg-success' : 'bg-secondary';
        body.appendChild(
          el('div', { className: 'mb-2' }, [
            el('span', { className: `badge ${roleClass} me-2`, textContent: m.role }),
            el('small', { className: 'text-muted', textContent: new Date(m.createdAt).toLocaleString() }),
            el('div', { className: 'border rounded p-2 mt-1', style: 'white-space: pre-wrap;', textContent: m.content || '(empty)' }),
          ]),
        );
      });
    }

    bsModal.show();
  } catch (err) {
    console.error('viewSessionMessages error:', err);
    showAlert('danger', 'Error loading messages');
  }
}

async function deleteSession(sessionId) {
  if (!confirm('Are you sure you want to delete this session and all its messages?')) return;
  try {
    const res = await apiFetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' });
    if (res.ok) loadSessions();
    else showAlert('danger', 'Error deleting session');
  } catch {
    showAlert('danger', 'Error deleting session');
  }
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
async function loadTools() {
  try {
    const res = await apiFetch('/api/admin/tools');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading tools' }));
      return;
    }

    const tbody = el('tbody');
    (data.tools || []).forEach((tool) => {
      const enabledBadge = tool.enabled
        ? el('span', { className: 'badge bg-success', textContent: 'Enabled' })
        : el('span', { className: 'badge bg-secondary', textContent: 'Disabled' });
      const typeBadge = el('span', { className: 'badge bg-info', textContent: tool.type });
      const desc = (tool.description || '').length > 60
        ? tool.description.slice(0, 60) + '...'
        : tool.description || '';
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: tool.displayName }),
          el('td', {}, [typeBadge]),
          el('td', { textContent: desc }),
          el('td', {}, [enabledBadge]),
          el('td', {}, [
            el('button', {
              className: 'btn btn-sm btn-outline-primary me-1',
              onClick: () => showToolModal(tool),
            }, [el('i', { className: 'fas fa-edit' }), ' Edit']),
            el('button', {
              className: `btn btn-sm me-1 ${tool.enabled ? 'btn-outline-warning' : 'btn-outline-success'}`,
              onClick: () => toggleTool(tool._id),
            }, [el('i', { className: `fas ${tool.enabled ? 'fa-pause' : 'fa-play'}` }), tool.enabled ? ' Disable' : ' Enable']),
            el('button', {
              className: 'btn btn-sm btn-outline-danger',
              onClick: () => deleteTool(tool._id),
            }, [el('i', { className: 'fas fa-trash' }), ' Delete']),
          ]),
        ]),
      );
    });

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-wrench' }), ' Tools']),
        el('button', {
          className: 'btn btn-primary',
          onClick: () => showToolModal(),
        }, [el('i', { className: 'fas fa-plus' }), ' Add Tool']),
      ]),
      el('div', { className: 'table-responsive' }, [
        el('table', { className: 'table table-striped' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { textContent: 'Display Name' }),
              el('th', { textContent: 'Type' }),
              el('th', { textContent: 'Description' }),
              el('th', { textContent: 'Status' }),
              el('th', { textContent: 'Actions' }),
            ]),
          ]),
          tbody,
        ]),
      ]),
    );
  } catch (err) {
    console.error('loadTools error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading tools' }));
  }
}

function showToolModal(tool = null) {
  const modal = document.getElementById('toolModal');
  const bsModal = new bootstrap.Modal(modal);

  document.getElementById('toolModalTitle').textContent = tool ? 'Edit Tool' : 'Add New Tool';
  document.getElementById('toolName').value = tool?.name || '';
  document.getElementById('toolDisplayName').value = tool?.displayName || '';
  document.getElementById('toolDescription').value = tool?.description || '';
  document.getElementById('toolType').value = tool?.type || 'wikipedia';
  document.getElementById('toolEnabled').checked = tool?.enabled || false;
  document.getElementById('toolConfigMaxResults').value = tool?.config?.maxResults ?? 3;
  document.getElementById('toolConfigLanguage').value = tool?.config?.language || 'en';

  // Show/hide Wikipedia-specific config section based on type
  const updateWikiSection = () => {
    const isWiki = document.getElementById('toolType').value === 'wikipedia';
    document.getElementById('toolWikipediaConfig').style.display = isWiki ? '' : 'none';
  };
  updateWikiSection();
  const toolTypeEl = document.getElementById('toolType');
  toolTypeEl.replaceWith(toolTypeEl.cloneNode(true)); // remove old listeners
  document.getElementById('toolType').addEventListener('change', updateWikiSection);

  const saveBtn = document.getElementById('saveTool');
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  document.getElementById('saveTool').addEventListener('click', () =>
    saveTool(tool?._id, bsModal),
  );
  bsModal.show();
}

async function saveTool(toolId, bsModal) {
  const payload = {
    name: document.getElementById('toolName').value.trim(),
    displayName: document.getElementById('toolDisplayName').value.trim(),
    description: document.getElementById('toolDescription').value.trim(),
    type: document.getElementById('toolType').value,
    enabled: document.getElementById('toolEnabled').checked,
    config: {},
  };
  const maxResults = document.getElementById('toolConfigMaxResults').value;
  if (maxResults !== '') payload.config.maxResults = parseInt(maxResults, 10);
  const language = document.getElementById('toolConfigLanguage').value.trim();
  if (language) payload.config.language = language;

  if (!payload.name || !payload.displayName || !payload.description) {
    showAlert('warning', 'Name, Display Name, and Description are required');
    return;
  }

  try {
    const url = toolId ? `/api/admin/tools/${toolId}` : '/api/admin/tools';
    const method = toolId ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (res.ok) {
      bsModal.hide();
      loadTools();
    } else {
      const d = await res.json();
      showAlert('danger', d.message || 'Error saving tool');
    }
  } catch {
    showAlert('danger', 'Error saving tool');
  }
}

async function toggleTool(toolId) {
  try {
    const res = await apiFetch(`/api/admin/tools/${toolId}/toggle`, { method: 'POST' });
    if (res.ok) loadTools();
    else showAlert('danger', 'Error toggling tool');
  } catch {
    showAlert('danger', 'Error toggling tool');
  }
}

async function deleteTool(toolId) {
  if (!confirm('Are you sure you want to delete this tool?')) return;
  try {
    const res = await apiFetch(`/api/admin/tools/${toolId}`, { method: 'DELETE' });
    if (res.ok) loadTools();
    else showAlert('danger', 'Error deleting tool');
  } catch {
    showAlert('danger', 'Error deleting tool');
  }
}

// ---------------------------------------------------------------------------
// Client Memories
// ---------------------------------------------------------------------------
async function loadClientMemories() {
  try {
    const res = await apiFetch('/api/admin/client-memories');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading client memories' }));
      return;
    }

    const tbody = el('tbody');
    (data.memories || []).forEach((mem) => {
      const userEmail = mem.userId?.email || mem.userId || '—';
      const botName = mem.botId?.name || mem.botId || '—';
      const keys = Object.keys(mem.data || {});
      const preview = keys.length === 0 ? el('em', { textContent: 'empty' }) : el('span', { textContent: keys.slice(0, 4).join(', ') + (keys.length > 4 ? ` +${keys.length - 4} more` : '') });
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: userEmail }),
          el('td', { textContent: botName }),
          el('td', {}, [preview]),
          el('td', {}, [
            el('button', {
              className: 'btn btn-sm btn-outline-primary me-1',
              onClick: () => showClientMemoryModal(mem),
            }, [el('i', { className: 'fas fa-edit' }), ' Edit']),
            el('button', {
              className: 'btn btn-sm btn-outline-danger',
              onClick: () => deleteClientMemory(mem._id),
            }, [el('i', { className: 'fas fa-trash' }), ' Delete']),
          ]),
        ]),
      );
    });

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-brain' }), ' Client Memories']),
      ]),
      (data.memories || []).length === 0
        ? el('div', { className: 'alert alert-info', textContent: 'No client memory entries yet. They are created automatically when a bot uses the Client Memory tool.' })
        : el('div', { className: 'table-responsive' }, [
            el('table', { className: 'table table-striped' }, [
              el('thead', {}, [
                el('tr', {}, [
                  el('th', { textContent: 'User' }),
                  el('th', { textContent: 'Bot' }),
                  el('th', { textContent: 'Stored Keys' }),
                  el('th', { textContent: 'Actions' }),
                ]),
              ]),
              tbody,
            ]),
          ]),
    );
  } catch (err) {
    console.error('loadClientMemories error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading client memories' }));
  }
}

function showClientMemoryModal(mem) {
  const modal = document.getElementById('clientMemoryModal');
  const bsModal = new bootstrap.Modal(modal);

  document.getElementById('clientMemoryModalTitle').textContent = 'Edit Client Memory';
  document.getElementById('cmUserEmail').value = mem.userId?.email || String(mem.userId) || '';
  document.getElementById('cmBotName').value = mem.botId?.name || String(mem.botId) || '';
  document.getElementById('cmData').value = JSON.stringify(mem.data || {}, null, 2);

  const saveBtn = document.getElementById('saveClientMemory');
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  document.getElementById('saveClientMemory').addEventListener('click', () =>
    saveClientMemory(mem._id, bsModal),
  );
  bsModal.show();
}

async function saveClientMemory(memId, bsModal) {
  const raw = document.getElementById('cmData').value.trim();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    showAlert('warning', 'Memory data must be valid JSON');
    return;
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    showAlert('warning', 'Memory data must be a JSON object (not an array)');
    return;
  }
  try {
    const res = await apiFetch(`/api/admin/client-memories/${memId}`, {
      method: 'PUT',
      body: JSON.stringify({ data }),
    });
    if (res.ok) {
      bsModal.hide();
      loadClientMemories();
    } else {
      const d = await res.json();
      showAlert('danger', d.message || 'Error saving memory');
    }
  } catch {
    showAlert('danger', 'Error saving memory');
  }
}

async function deleteClientMemory(memId) {
  if (!confirm('Delete this memory entry? The bot will no longer remember anything about this user.')) return;
  try {
    const res = await apiFetch(`/api/admin/client-memories/${memId}`, { method: 'DELETE' });
    if (res.ok) loadClientMemories();
    else showAlert('danger', 'Error deleting memory');
  } catch {
    showAlert('danger', 'Error deleting memory');
  }
}

// ---------------------------------------------------------------------------
// Playground
// ---------------------------------------------------------------------------
let playgroundSessionId = null;
let playgroundSocket = null;
let playgroundStreamingBubble = null;
let playgroundStreamingRaw = '';

/** Disconnect and reset playground socket/session state. */
function resetPlayground() {
  if (playgroundSocket) {
    playgroundSocket.disconnect();
    playgroundSocket = null;
  }
  playgroundSessionId = null;
  playgroundStreamingBubble = null;
  playgroundStreamingRaw = '';
}

/** Append a chat bubble to the playground chat area. */
function appendPlaygroundBubble(area, role, text, streaming) {
  const isUser = role === 'user';
  const wrapper = el('div', { className: `d-flex mb-2 ${isUser ? 'justify-content-end' : 'justify-content-start'}` });
  const bubble = el('div', {
    className: `px-3 py-2 rounded-3 ${isUser ? 'bg-primary text-white' : 'bg-light border'}`,
    style: isUser ? 'max-width:75%;white-space:pre-wrap' : 'max-width:75%;word-break:break-word',
  });
  if (streaming) {
    const spinner = el('span', { className: 'spinner-grow spinner-grow-sm me-1' });
    bubble.appendChild(spinner);
  } else {
    bubble.textContent = text;
  }
  wrapper.appendChild(bubble);
  area.appendChild(wrapper);
  area.scrollTop = area.scrollHeight;
  return bubble;
}

async function loadPlayground() {
  resetPlayground();
  try {
    const res = await apiFetch('/api/bots');
    const data = await res.json();
    if (!res.ok) {
      replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading bots' }));
      return;
    }

    const bots = data.bots || [];
    const select = el('select', { className: 'form-select', id: 'playgroundBotSelect' }, [
      el('option', { value: '', textContent: 'Select a bot' }),
    ]);
    bots.forEach((bot) => {
      select.appendChild(el('option', { value: bot._id, textContent: bot.name }));
    });

    const statusSpan = el('span', {
      id: 'playgroundStatus',
      className: 'text-muted small',
      textContent: 'No active session',
    });

    const chatArea = el('div', {
      className: 'card-body overflow-auto',
      id: 'playgroundChatArea',
      style: 'min-height:300px;max-height:500px',
    }, [el('p', { className: 'text-muted', textContent: 'Select a bot and start a session to begin chatting' })]);

    const msgInput = el('input', {
      type: 'text',
      className: 'form-control',
      id: 'playgroundMessage',
      placeholder: 'Type your message...',
      disabled: 'disabled',
    });
    msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessageToBot(); });

    const sendBtn = el('button', {
      className: 'btn btn-primary',
      id: 'sendMsgBtn',
      disabled: 'disabled',
    }, [el('i', { className: 'fas fa-paper-plane' }), ' Send']);
    sendBtn.addEventListener('click', sendMessageToBot);

    replaceChildren(
      contentDiv,
      el('div', { className: 'd-flex justify-content-between align-items-center mb-3' }, [
        el('h2', {}, [el('i', { className: 'fas fa-play-circle' }), ' Playground']),
      ]),
      el('div', { className: 'row' }, [
        el('div', { className: 'col-md-4' }, [
          el('div', { className: 'card' }, [
            el('div', { className: 'card-header' }, [el('h5', { textContent: 'Select Bot' })]),
            el('div', { className: 'card-body' }, [
              select,
              el('button', {
                className: 'btn btn-primary w-100 mt-3',
                id: 'startSessionBtn',
                onClick: startPlaygroundSession,
                textContent: 'Start Session',
              }),
            ]),
          ]),
        ]),
        el('div', { className: 'col-md-8' }, [
          el('div', { className: 'card h-100' }, [
            el('div', { className: 'card-header d-flex justify-content-between align-items-center' }, [
              el('h5', { className: 'mb-0', textContent: 'Chat Interface' }),
              statusSpan,
            ]),
            chatArea,
            el('div', { className: 'card-footer' }, [
              el('div', { className: 'input-group' }, [msgInput, sendBtn]),
            ]),
          ]),
        ]),
      ]),
    );
  } catch (err) {
    console.error('loadPlayground error:', err);
    replaceChildren(contentDiv, el('div', { className: 'alert alert-danger', textContent: 'Error loading playground' }));
  }
}

async function startPlaygroundSession() {
  const botId = document.getElementById('playgroundBotSelect').value;
  if (!botId) {
    showAlert('warning', 'Please select a bot');
    return;
  }

  const startBtn = document.getElementById('startSessionBtn');
  if (startBtn) startBtn.disabled = true;

  // Reset any prior session/socket
  resetPlayground();

  try {
    // Create a real ChatSession via the standard API
    const res = await apiFetch('/api/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ botId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAlert('danger', data.message || 'Error starting session');
      if (startBtn) startBtn.disabled = false;
      return;
    }

    playgroundSessionId = data.session._id;

    // Connect via socket.io using current JWT
    const socketUrl = apiBaseUrl || window.location.origin;
    // io() is provided by the socket.io-client CDN script loaded in index.html
    playgroundSocket = window.io(socketUrl, {
      auth: { token: currentToken },
      transports: ['websocket', 'polling'],
    });

    playgroundSocket.on('connect', () => {
      const botName = data.session.botId?.name || '';
      const statusEl = document.getElementById('playgroundStatus');
      if (statusEl) statusEl.textContent = `Session active${botName ? ' · ' + botName : ''}`;
      const msgInput = document.getElementById('playgroundMessage');
      const sendBtn = document.getElementById('sendMsgBtn');
      if (msgInput) msgInput.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      if (startBtn) startBtn.disabled = false;
    });

    playgroundSocket.on('connect_error', (err) => {
      const statusEl = document.getElementById('playgroundStatus');
      if (statusEl) statusEl.textContent = 'Connection error';
      const area = document.getElementById('playgroundChatArea');
      if (area) appendPlaygroundBubble(area, 'system', `⚠ Connection failed: ${err.message}`, false);
      if (startBtn) startBtn.disabled = false;
    });

    playgroundSocket.on('chat:token', ({ token }) => {
      const area = document.getElementById('playgroundChatArea');
      if (!area) return;
      if (!playgroundStreamingBubble) {
        playgroundStreamingRaw = '';
        playgroundStreamingBubble = appendPlaygroundBubble(area, 'assistant', '', true);
      }
      playgroundStreamingRaw += token;
      playgroundStreamingBubble.textContent = playgroundStreamingRaw;
      area.scrollTop = area.scrollHeight;
    });

    playgroundSocket.on('chat:done', () => {
      // Render the fully accumulated response as markdown
      if (playgroundStreamingBubble && playgroundStreamingRaw) {
        playgroundStreamingBubble.innerHTML = renderMarkdown(playgroundStreamingRaw);
      }
      playgroundStreamingBubble = null;
      playgroundStreamingRaw = '';
      const msgInput = document.getElementById('playgroundMessage');
      const sendBtn = document.getElementById('sendMsgBtn');
      if (msgInput) msgInput.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
    });

    playgroundSocket.on('chat:error', ({ error }) => {
      playgroundStreamingBubble = null;
      const area = document.getElementById('playgroundChatArea');
      if (area) appendPlaygroundBubble(area, 'system', `⚠ ${error}`, false);
      const msgInput = document.getElementById('playgroundMessage');
      const sendBtn = document.getElementById('sendMsgBtn');
      if (msgInput) msgInput.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
    });

    // Clear chat area for the new session
    const chatArea = document.getElementById('playgroundChatArea');
    if (chatArea) chatArea.textContent = '';

  } catch (err) {
    showAlert('danger', `Error starting session: ${err.message}`);
    if (startBtn) startBtn.disabled = false;
  }
}

async function sendMessageToBot() {
  const msgInput = document.getElementById('playgroundMessage');
  const message = msgInput?.value?.trim();

  if (!message) return;
  if (!playgroundSessionId || !playgroundSocket?.connected) {
    showAlert('warning', 'Please start a session first');
    return;
  }

  msgInput.value = '';
  msgInput.disabled = true;
  const sendBtn = document.getElementById('sendMsgBtn');
  if (sendBtn) sendBtn.disabled = true;
  playgroundStreamingBubble = null;
  playgroundStreamingRaw = '';

  const area = document.getElementById('playgroundChatArea');
  appendPlaygroundBubble(area, 'user', message, false);

  playgroundSocket.emit('chat:send', { sessionId: playgroundSessionId, content: message });
}