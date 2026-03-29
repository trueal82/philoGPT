import { Admin, Resource, CustomRoutes, Layout, Menu } from 'react-admin';
import { Route } from 'react-router-dom';

import { createAuthProvider } from './authProvider';
import { createDataProvider } from './dataProvider';

import Dashboard from './pages/Dashboard';
import SystemPromptPage from './pages/SystemPromptPage';

import { UserList, UserEdit } from './resources/users';
import { BotList, BotCreate, BotEdit } from './resources/bots';
import { LlmConfigList, LlmConfigCreate, LlmConfigEdit } from './resources/llmConfigs';
import { LanguageList, LanguageCreate, LanguageEdit } from './resources/languages';
import { UserGroupList, UserGroupCreate, UserGroupEdit } from './resources/userGroups';
import { SubscriptionList, SubscriptionCreate, SubscriptionEdit } from './resources/subscriptions';
import { ToolList, ToolCreate, ToolEdit } from './resources/tools';
import { SessionList, SessionShow } from './resources/sessions';
import { ClientMemoryList, ClientMemoryCreate, ClientMemoryEdit } from './resources/clientMemories';

function AdminMenu() {
  return (
    <Menu>
      <Menu.DashboardItem />
      <Menu.ResourceItems />
      <Menu.Item to="/system-prompt" primaryText="System Prompt" />
    </Menu>
  );
}

const MyLayout = (props: Parameters<typeof Layout>[0]) => <Layout {...props} menu={AdminMenu} />;

interface AppProps {
  apiUrl: string;
}

export default function App({ apiUrl }: AppProps) {
  const dataProvider = createDataProvider(apiUrl);
  const authProvider = createAuthProvider(apiUrl);

  return (
    <Admin
      dataProvider={dataProvider}
      authProvider={authProvider}
      dashboard={Dashboard}
      layout={MyLayout}
      requireAuth
      title="PhiloGPT Admin"
    >
      <Resource name="users" list={UserList} edit={UserEdit} />
      <Resource name="bots" list={BotList} create={BotCreate} edit={BotEdit} />
      <Resource name="llm-configs" list={LlmConfigList} create={LlmConfigCreate} edit={LlmConfigEdit} />
      <Resource name="languages" list={LanguageList} create={LanguageCreate} edit={LanguageEdit} />
      <Resource name="user-groups" list={UserGroupList} create={UserGroupCreate} edit={UserGroupEdit} />
      <Resource name="subscriptions" list={SubscriptionList} create={SubscriptionCreate} edit={SubscriptionEdit} />
      <Resource name="tools" list={ToolList} create={ToolCreate} edit={ToolEdit} />
      <Resource name="sessions" list={SessionList} show={SessionShow} />
      <Resource name="client-memories" list={ClientMemoryList} create={ClientMemoryCreate} edit={ClientMemoryEdit} />

      <CustomRoutes>
        <Route path="/system-prompt" element={<SystemPromptPage />} />
      </CustomRoutes>
    </Admin>
  );
}
