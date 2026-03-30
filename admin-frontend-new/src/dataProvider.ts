import { DataProvider, fetchUtils } from 'react-admin';
import { getToken } from './authProvider';

// ---------------------------------------------------------------------------
// HTTP client with JWT
// ---------------------------------------------------------------------------
const httpClient = (url: string, options: fetchUtils.Options = {}) => {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetchUtils.fetchJson(url, { ...options, headers });
};

// ---------------------------------------------------------------------------
// Resource metadata: maps react-admin resource name → API paths + response keys
// ---------------------------------------------------------------------------
interface ResourceMeta {
  listUrl: string;
  oneUrl: string;                // with :id placeholder
  createUrl?: string;
  updateUrl?: string;            // with :id placeholder
  deleteUrl?: string;            // with :id placeholder
  listKey: string;               // key in JSON response that holds the array
  singleKey: string;             // key in JSON response that holds one record
}

const buildMeta = (apiUrl: string): Record<string, ResourceMeta> => ({
  users: {
    listUrl: `${apiUrl}/api/admin/users`,
    oneUrl: `${apiUrl}/api/admin/users/:id`,
    updateUrl: `${apiUrl}/api/admin/users/:id`,
    deleteUrl: `${apiUrl}/api/admin/users/:id`,
    listKey: 'users',
    singleKey: 'user',
  },
  'llm-configs': {
    listUrl: `${apiUrl}/api/admin/llm-configs`,
    oneUrl: `${apiUrl}/api/admin/llm-configs/:id`,
    createUrl: `${apiUrl}/api/admin/llm-configs`,
    updateUrl: `${apiUrl}/api/admin/llm-configs/:id`,
    deleteUrl: `${apiUrl}/api/admin/llm-configs/:id`,
    listKey: 'configs',
    singleKey: 'config',
  },
  bots: {
    listUrl: `${apiUrl}/api/admin/bots`,
    oneUrl: `${apiUrl}/api/bots/:id`,
    createUrl: `${apiUrl}/api/bots`,
    updateUrl: `${apiUrl}/api/bots/:id`,
    deleteUrl: `${apiUrl}/api/bots/:id`,
    listKey: 'bots',
    singleKey: 'bot',
  },
  languages: {
    listUrl: `${apiUrl}/api/admin/languages`,
    oneUrl: `${apiUrl}/api/admin/languages/:id`,
    createUrl: `${apiUrl}/api/admin/languages`,
    updateUrl: `${apiUrl}/api/admin/languages/:id`,
    deleteUrl: `${apiUrl}/api/admin/languages/:id`,
    listKey: 'languages',
    singleKey: 'language',
  },
  'user-groups': {
    listUrl: `${apiUrl}/api/admin/user-groups`,
    oneUrl: `${apiUrl}/api/admin/user-groups/:id`,
    createUrl: `${apiUrl}/api/admin/user-groups`,
    updateUrl: `${apiUrl}/api/admin/user-groups/:id`,
    deleteUrl: `${apiUrl}/api/admin/user-groups/:id`,
    listKey: 'userGroups',
    singleKey: 'userGroup',
  },
  subscriptions: {
    listUrl: `${apiUrl}/api/admin/subscriptions`,
    oneUrl: `${apiUrl}/api/admin/subscriptions/:id`,
    createUrl: `${apiUrl}/api/admin/subscriptions`,
    updateUrl: `${apiUrl}/api/admin/subscriptions/:id`,
    deleteUrl: `${apiUrl}/api/admin/subscriptions/:id`,
    listKey: 'subscriptions',
    singleKey: 'subscription',
  },
  tools: {
    listUrl: `${apiUrl}/api/admin/tools`,
    oneUrl: `${apiUrl}/api/admin/tools/:id`,
    createUrl: `${apiUrl}/api/admin/tools`,
    updateUrl: `${apiUrl}/api/admin/tools/:id`,
    deleteUrl: `${apiUrl}/api/admin/tools/:id`,
    listKey: 'tools',
    singleKey: 'tool',
  },
  'client-memories': {
    listUrl: `${apiUrl}/api/admin/client-memories`,
    oneUrl: `${apiUrl}/api/admin/client-memories/:id`,
    createUrl: `${apiUrl}/api/admin/client-memories`,
    updateUrl: `${apiUrl}/api/admin/client-memories/:id`,
    deleteUrl: `${apiUrl}/api/admin/client-memories/:id`,
    listKey: 'memories',
    singleKey: 'memory',
  },
  sessions: {
    listUrl: `${apiUrl}/api/admin/sessions`,
    oneUrl: `${apiUrl}/api/admin/sessions/:id`,
    deleteUrl: `${apiUrl}/api/admin/sessions/:id`,
    listKey: 'sessions',
    singleKey: 'session',
  },
  'smtp-configs': {
    listUrl: `${apiUrl}/api/admin/smtp-configs`,
    oneUrl: `${apiUrl}/api/admin/smtp-configs/:id`,
    createUrl: `${apiUrl}/api/admin/smtp-configs`,
    updateUrl: `${apiUrl}/api/admin/smtp-configs/:id`,
    deleteUrl: `${apiUrl}/api/admin/smtp-configs/:id`,
    listKey: 'configs',
    singleKey: 'config',
  },
  'tool-call-logs': {
    listUrl: `${apiUrl}/api/admin/tool-call-logs`,
    oneUrl: `${apiUrl}/api/admin/tool-call-logs/:id`,
    listKey: 'logs',
    singleKey: 'log',
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remap MongoDB _id → id on a single record */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapId(record: any) {
  if (!record) return record;
  const { _id, ...rest } = record;
  return { id: _id ?? record.id, ...rest };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIds(records: any[]) {
  return records.map(mapId);
}

/** Client-side sort */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortData(data: any[], field: string, order: string) {
  return [...data].sort((a, b) => {
    const va = a[field] ?? '';
    const vb = b[field] ?? '';
    if (va < vb) return order === 'ASC' ? -1 : 1;
    if (va > vb) return order === 'ASC' ? 1 : -1;
    return 0;
  });
}

/** Client-side filter (simple equality / substring) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterData(data: any[], filter: Record<string, unknown>) {
  if (!filter || Object.keys(filter).length === 0) return data;
  return data.filter((item) =>
    Object.entries(filter).every(([key, value]) => {
      if (value === undefined || value === null || value === '') return true;
      const itemVal = item[key];
      if (typeof itemVal === 'string' && typeof value === 'string') {
        return itemVal.toLowerCase().includes(value.toLowerCase());
      }
      return itemVal === value;
    }),
  );
}

// ---------------------------------------------------------------------------
// Extended DataProvider type with custom methods
// ---------------------------------------------------------------------------
export interface PhiloDataProvider extends DataProvider {
  lockUser: (id: string, reason?: string) => Promise<{ data: unknown }>;
  unlockUser: (id: string) => Promise<{ data: unknown }>;
  toggleTool: (id: string) => Promise<{ data: unknown }>;
  getBotLocales: (botId: string) => Promise<{ data: unknown[] }>;
  saveBotLocale: (botId: string, languageCode: string, body: Record<string, unknown>) => Promise<{ data: unknown }>;
  deleteBotLocale: (botId: string, languageCode: string) => Promise<void>;
  getSystemPrompt: () => Promise<{ data: unknown }>;
  saveSystemPrompt: (content: string) => Promise<{ data: unknown }>;
  saveSystemPromptLocale: (languageCode: string, content: string) => Promise<{ data: unknown }>;
  deleteSystemPromptLocale: (languageCode: string) => Promise<{ data: unknown }>;
  getSessionMessages: (sessionId: string) => Promise<{ data: unknown[] }>;
  testSmtpConfig: (payload: Record<string, unknown>) => Promise<{ data: unknown }>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export const createDataProvider = (apiUrl: string): PhiloDataProvider => {
  const meta = buildMeta(apiUrl);

  function getMeta(resource: string): ResourceMeta {
    const m = meta[resource];
    if (!m) throw new Error(`Unknown resource: ${resource}`);
    return m;
  }

  const provider: any = {
    // -----------------------------------------------------------------------
    // getList
    // -----------------------------------------------------------------------
    async getList(resource: any, params: any) {
      const m = getMeta(resource);
      const { page, perPage } = params.pagination || { page: 1, perPage: 25 };
      const { field, order } = params.sort || { field: 'id', order: 'ASC' };

      // Sessions support server-side pagination
      if (resource === 'sessions') {
        const query = new URLSearchParams();
        query.set('page', String(page));
        query.set('limit', String(perPage));
        if (params.filter?.userId) query.set('userId', params.filter.userId);
        const { json } = await httpClient(`${m.listUrl}?${query}`);
        return {
          data: mapIds(json[m.listKey]),
          total: json.total,
        };
      }

      // All other resources: fetch all, client-side sort/filter/paginate
      const { json } = await httpClient(m.listUrl);
      const rawList = json?.[m.listKey];
      let data = mapIds(Array.isArray(rawList) ? rawList : []);
      data = filterData(data, params.filter);
      data = sortData(data, field, order);
      const total = data.length;
      const start = (page - 1) * perPage;
      data = data.slice(start, start + perPage);
      return { data, total };
    },

    // -----------------------------------------------------------------------
    // getOne
    // -----------------------------------------------------------------------
    async getOne(resource: any, params: any) {
      const m = getMeta(resource);
      const url = m.oneUrl.replace(':id', String(params.id));
      const { json } = await httpClient(url);
      return { data: mapId(json[m.singleKey] || json) };
    },

    // -----------------------------------------------------------------------
    // getMany — sequential getOne calls (no bulk endpoint)
    // -----------------------------------------------------------------------
    async getMany(resource: any, params: any) {
      const results = await Promise.all(
        params.ids.map((id: any) => provider.getOne(resource, { id })),
      );
      return { data: results.map((r) => r.data) };
    },

    // -----------------------------------------------------------------------
    // getManyReference — delegates to getList with filter
    // -----------------------------------------------------------------------
    async getManyReference(resource: any, params: any) {
      return provider.getList(resource, {
        ...params,
        filter: { ...params.filter, [params.target]: params.id },
      });
    },

    // -----------------------------------------------------------------------
    // create
    // -----------------------------------------------------------------------
    async create(resource: any, params: any) {
      const m = getMeta(resource);
      if (!m.createUrl) throw new Error(`Create not supported for ${resource}`);
      const { json } = await httpClient(m.createUrl, {
        method: 'POST',
        body: JSON.stringify(params.data),
      });
      return { data: mapId(json[m.singleKey] || json) };
    },

    // -----------------------------------------------------------------------
    // update
    // -----------------------------------------------------------------------
    async update(resource: any, params: any) {
      const m = getMeta(resource);
      const url = (m.updateUrl || m.oneUrl).replace(':id', String(params.id));
      const { json } = await httpClient(url, {
        method: 'PUT',
        body: JSON.stringify(params.data),
      });
      return { data: mapId(json[m.singleKey] || json) };
    },

    // -----------------------------------------------------------------------
    // updateMany
    // -----------------------------------------------------------------------
    async updateMany(resource: any, params: any) {
      await Promise.all(
        params.ids.map((id: any) =>
          provider.update(resource, { id, data: params.data, previousData: {} as Record<string, unknown> }),
        ),
      );
      return { data: params.ids };
    },

    // -----------------------------------------------------------------------
    // delete
    // -----------------------------------------------------------------------
    async delete(resource: any, params: any) {
      const m = getMeta(resource);
      const url = (m.deleteUrl || m.oneUrl).replace(':id', String(params.id));
      await httpClient(url, { method: 'DELETE' });
      return { data: { id: params.id } };
    },

    // -----------------------------------------------------------------------
    // deleteMany
    // -----------------------------------------------------------------------
    async deleteMany(resource: any, params: any) {
      await Promise.all(
        params.ids.map((id: any) => provider.delete(resource, { id, previousData: { id } })),
      );
      return { data: params.ids };
    },

    // -----------------------------------------------------------------------
    // Custom methods
    // -----------------------------------------------------------------------

    async lockUser(id: string, reason?: string) {
      const { json } = await httpClient(`${apiUrl}/api/admin/users/${id}/lock`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      return { data: mapId(json.user || json) };
    },

    async unlockUser(id: string) {
      const { json } = await httpClient(`${apiUrl}/api/admin/users/${id}/unlock`, {
        method: 'POST',
      });
      return { data: mapId(json.user || json) };
    },

    async toggleTool(id: string) {
      const { json } = await httpClient(`${apiUrl}/api/admin/tools/${id}/toggle`, {
        method: 'POST',
      });
      return { data: mapId(json.tool || json) };
    },

    async getBotLocales(botId: string) {
      const { json } = await httpClient(`${apiUrl}/api/admin/bot-locales/${botId}`);
      return { data: mapIds(json.locales || []) };
    },

    async saveBotLocale(botId: string, languageCode: string, body: Record<string, unknown>) {
      const { json } = await httpClient(
        `${apiUrl}/api/admin/bot-locales/${botId}/${languageCode}`,
        { method: 'PUT', body: JSON.stringify(body) },
      );
      return { data: mapId(json.locale || json) };
    },

    async deleteBotLocale(botId: string, languageCode: string) {
      await httpClient(`${apiUrl}/api/admin/bot-locales/${botId}/${languageCode}`, {
        method: 'DELETE',
      });
    },

    async getSystemPrompt() {
      const { json } = await httpClient(`${apiUrl}/api/admin/system-prompt`);
      return { data: json.prompt ? mapId(json.prompt) : null };
    },

    async saveSystemPrompt(content: string) {
      const { json } = await httpClient(`${apiUrl}/api/admin/system-prompt`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
      return { data: mapId(json.prompt || json) };
    },

    async saveSystemPromptLocale(languageCode: string, content: string) {
      const { json } = await httpClient(
        `${apiUrl}/api/admin/system-prompt/locales/${languageCode}`,
        { method: 'PUT', body: JSON.stringify({ content }) },
      );
      return { data: mapId(json.prompt || json) };
    },

    async deleteSystemPromptLocale(languageCode: string) {
      const { json } = await httpClient(
        `${apiUrl}/api/admin/system-prompt/locales/${languageCode}`,
        { method: 'DELETE' },
      );
      return { data: mapId(json.prompt || json) };
    },

    async getSessionMessages(sessionId: string) {
      const { json } = await httpClient(`${apiUrl}/api/admin/sessions/${sessionId}/messages`);
      return { data: mapIds(json.messages || []) };
    },

    async testSmtpConfig(payload: Record<string, unknown>) {
      const { json } = await httpClient(`${apiUrl}/api/admin/smtp-configs/test`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { data: json };
    },
  };

  return provider as PhiloDataProvider;
};
