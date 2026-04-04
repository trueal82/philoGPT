import { Admin, Resource, CustomRoutes, Layout, Menu } from 'react-admin';
import { Route } from 'react-router-dom';
import { Typography } from '@mui/material';

// Icons
import PeopleIcon from '@mui/icons-material/People';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TranslateIcon from '@mui/icons-material/Translate';
import CommentIcon from '@mui/icons-material/Comment';
import MemoryIcon from '@mui/icons-material/Memory';
import BuildIcon from '@mui/icons-material/Build';
import EmailIcon from '@mui/icons-material/Email';
import ChatIcon from '@mui/icons-material/Chat';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AssignmentIcon from '@mui/icons-material/Assignment';

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
import { SmtpConfigList, SmtpConfigCreate, SmtpConfigEdit } from './resources/smtpConfigs';
import { ToolCallLogList, ToolCallLogShow } from './resources/toolCallLogs';
import { CounselingPlanList, CounselingPlanShow } from './resources/counselingPlans';

function MenuGroupLabel({ label }: { label: string }) {
  return (
    <Typography
      variant="overline"
      sx={{ px: 2, pt: 2, pb: 0.5, display: 'block', color: 'text.secondary', fontSize: '0.65rem' }}
    >
      {label}
    </Typography>
  );
}

function AdminMenu() {
  return (
    <Menu>
      <Menu.DashboardItem />

      <MenuGroupLabel label="Users & Access" />
      <Menu.ResourceItem name="users" />
      <Menu.ResourceItem name="user-groups" />
      <Menu.ResourceItem name="subscriptions" />

      <MenuGroupLabel label="Bots & Content" />
      <Menu.ResourceItem name="bots" />
      <Menu.ResourceItem name="languages" />
      <Menu.Item to="/system-prompt" primaryText="System Prompt" leftIcon={<CommentIcon />} />

      <MenuGroupLabel label="Infrastructure" />
      <Menu.ResourceItem name="llm-configs" />
      <Menu.ResourceItem name="tools" />
      <Menu.ResourceItem name="smtp-configs" />

      <MenuGroupLabel label="Monitoring" />
      <Menu.ResourceItem name="sessions" />
      <Menu.ResourceItem name="client-memories" />
      <Menu.ResourceItem name="counseling-plans" />
      <Menu.ResourceItem name="tool-call-logs" />
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
      {/* --- Users & Access --- */}
      <Resource name="users" list={UserList} edit={UserEdit}
        icon={PeopleIcon} recordRepresentation="email"
        options={{ label: 'Users' }} />
      <Resource name="user-groups" list={UserGroupList} create={UserGroupCreate} edit={UserGroupEdit}
        icon={GroupWorkIcon} recordRepresentation="name"
        options={{ label: 'User Groups' }} />
      <Resource name="subscriptions" list={SubscriptionList} create={SubscriptionCreate} edit={SubscriptionEdit}
        icon={CardMembershipIcon} recordRepresentation="name"
        options={{ label: 'Subscriptions' }} />

      {/* --- Bots & Content --- */}
      <Resource name="bots" list={BotList} create={BotCreate} edit={BotEdit}
        icon={SmartToyIcon} recordRepresentation="name"
        options={{ label: 'Bots' }} />
      <Resource name="languages" list={LanguageList} create={LanguageCreate} edit={LanguageEdit}
        icon={TranslateIcon} recordRepresentation="name"
        options={{ label: 'Languages' }} />

      {/* --- Infrastructure --- */}
      <Resource name="llm-configs" list={LlmConfigList} create={LlmConfigCreate} edit={LlmConfigEdit}
        icon={MemoryIcon} recordRepresentation="name"
        options={{ label: 'LLM Configs' }} />
      <Resource name="tools" list={ToolList} create={ToolCreate} edit={ToolEdit}
        icon={BuildIcon} recordRepresentation="displayName"
        options={{ label: 'Tools' }} />
      <Resource name="smtp-configs" list={SmtpConfigList} create={SmtpConfigCreate} edit={SmtpConfigEdit}
        icon={EmailIcon} recordRepresentation="name"
        options={{ label: 'SMTP Configs' }} />

      {/* --- Monitoring --- */}
      <Resource name="sessions" list={SessionList} show={SessionShow}
        icon={ChatIcon}
        options={{ label: 'Sessions' }} />
      <Resource name="client-memories" list={ClientMemoryList} create={ClientMemoryCreate} edit={ClientMemoryEdit}
        icon={PsychologyIcon}
        options={{ label: 'Client Memories' }} />
      <Resource name="counseling-plans" list={CounselingPlanList} show={CounselingPlanShow}
        icon={AssignmentIcon}
        options={{ label: 'Counseling Plans' }} />
      <Resource name="tool-call-logs" list={ToolCallLogList} show={ToolCallLogShow}
        icon={ReceiptLongIcon}
        options={{ label: 'Tool Call Logs' }} />

      <CustomRoutes>
        <Route path="/system-prompt" element={<SystemPromptPage />} />
      </CustomRoutes>
    </Admin>
  );
}
