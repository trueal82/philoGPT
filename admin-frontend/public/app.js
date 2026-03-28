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
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: user.email }),
          el('td', {}, [el('span', { className: `badge ${badgeClass}`, textContent: user.role })]),
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
          el('td', { textContent: bot.name }),
          el('td', { textContent: bot.description || '' }),
          el('td', { textContent: bot.personality || '' }),
          el('td', {}, [
            el('button', {
              className: 'btn btn-sm btn-outline-primary me-1',
              onClick: () => editBot(bot),
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
          onClick: () => showBotModal(),
        }, [el('i', { className: 'fas fa-plus' }), ' Add Bot']),
      ]),
      el('div', { className: 'table-responsive' }, [
        el('table', { className: 'table table-striped' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { textContent: 'Name' }),
              el('th', { textContent: 'Description' }),
              el('th', { textContent: 'Personality' }),
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

async function showBotModal(bot = null) {
  const modal = document.getElementById('botModal');
  const bsModal = new bootstrap.Modal(modal);

  document.getElementById('botModalTitle').textContent = bot ? 'Edit Bot' : 'Add New Bot';
  document.getElementById('botName').value = bot?.name || '';
  document.getElementById('botDescription').value = bot?.description || '';
  document.getElementById('botPersonality').value = bot?.personality || '';
  document.getElementById('botSystemPrompt').value = bot?.systemPrompt || '';
  document.getElementById('botAvatar').value = bot?.avatar || '';

  // Populate subscriptions multi-select
  const subSelect = document.getElementById('botSubscriptions');
  subSelect.textContent = '';
  try {
    const subRes = await apiFetch('/api/admin/subscriptions');
    const subData = await subRes.json();
    const selectedIds = (bot?.availableToSubscriptionIds || []).map(String);
    (subData.subscriptions || []).forEach((sub) => {
      const opt = el('option', { value: sub._id, textContent: sub.name });
      if (selectedIds.includes(sub._id)) opt.selected = true;
      subSelect.appendChild(opt);
    });
  } catch { /* ignore */ }

  const saveBtn = document.getElementById('saveBot');
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  document.getElementById('saveBot').addEventListener('click', () => saveBot(bot?._id, bsModal));
  bsModal.show();
}

function editBot(bot) {
  showBotModal(bot);
}

async function saveBot(botId, bsModal) {
  const subSelect = document.getElementById('botSubscriptions');
  const availableToSubscriptionIds = Array.from(subSelect.selectedOptions).map((o) => o.value);

  const payload = {
    name: document.getElementById('botName').value.trim(),
    description: document.getElementById('botDescription').value.trim(),
    personality: document.getElementById('botPersonality').value.trim(),
    systemPrompt: document.getElementById('botSystemPrompt').value.trim(),
    avatar: document.getElementById('botAvatar').value.trim(),
    availableToSubscriptionIds,
  };

  if (!payload.name || !payload.systemPrompt) {
    showAlert('warning', 'Name and System Prompt are required');
    return;
  }

  try {
    const url = botId ? `/api/bots/${botId}` : '/api/bots';
    const method = botId ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (res.ok) {
      bsModal.hide();
      loadBots();
    } else {
      const d = await res.json();
      showAlert('danger', d.message || 'Error saving bot');
    }
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
      tbody.appendChild(
        el('tr', {}, [
          el('td', { textContent: config.name }),
          el('td', { textContent: config.provider }),
          el('td', { textContent: config.model || 'N/A' }),
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
// Playground
// ---------------------------------------------------------------------------
let playgroundSessionId = null;
let playgroundSocket = null;
let playgroundStreamingBubble = null;

/** Disconnect and reset playground socket/session state. */
function resetPlayground() {
  if (playgroundSocket) {
    playgroundSocket.disconnect();
    playgroundSocket = null;
  }
  playgroundSessionId = null;
  playgroundStreamingBubble = null;
}

/** Append a chat bubble to the playground chat area. */
function appendPlaygroundBubble(area, role, text, streaming) {
  const isUser = role === 'user';
  const wrapper = el('div', { className: `d-flex mb-2 ${isUser ? 'justify-content-end' : 'justify-content-start'}` });
  const bubble = el('div', {
    className: `px-3 py-2 rounded-3 ${isUser ? 'bg-primary text-white' : 'bg-light border'}`,
    style: 'max-width:75%;white-space:pre-wrap',
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
        playgroundStreamingBubble = appendPlaygroundBubble(area, 'assistant', '', true);
      }
      playgroundStreamingBubble.textContent += token;
      area.scrollTop = area.scrollHeight;
    });

    playgroundSocket.on('chat:done', () => {
      playgroundStreamingBubble = null;
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

  const area = document.getElementById('playgroundChatArea');
  appendPlaygroundBubble(area, 'user', message, false);

  playgroundSocket.emit('chat:send', { sessionId: playgroundSessionId, content: message });
}