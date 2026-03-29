import {
  List, Datagrid, TextField, DateField, FunctionField,
  EditButton, Edit, SimpleForm, SelectInput, TextInput,
  ReferenceInput, useRecordContext, useDataProvider, useRefresh, useNotify,
  TopToolbar, FilterButton, SearchInput,
} from 'react-admin';
import { Chip, Button, Box, Stack } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import type { PhiloDataProvider } from '../dataProvider';

// ---------------------------------------------------------------------------
// Lock / Unlock buttons
// ---------------------------------------------------------------------------
function LockUserButton() {
  const record = useRecordContext();
  const dataProvider = useDataProvider() as PhiloDataProvider;
  const refresh = useRefresh();
  const notify = useNotify();

  if (!record || record.isLocked) return null;

  const handleClick = async () => {
    try {
      await dataProvider.lockUser(record.id as string);
      notify('User locked', { type: 'success' });
      refresh();
    } catch {
      notify('Failed to lock user', { type: 'error' });
    }
  };

  return (
    <Button size="small" color="warning" startIcon={<LockIcon />} onClick={handleClick}>
      Lock
    </Button>
  );
}

function UnlockUserButton() {
  const record = useRecordContext();
  const dataProvider = useDataProvider() as PhiloDataProvider;
  const refresh = useRefresh();
  const notify = useNotify();

  if (!record || !record.isLocked) return null;

  const handleClick = async () => {
    try {
      await dataProvider.unlockUser(record.id as string);
      notify('User unlocked', { type: 'success' });
      refresh();
    } catch {
      notify('Failed to unlock user', { type: 'error' });
    }
  };

  return (
    <Button size="small" color="success" startIcon={<LockOpenIcon />} onClick={handleClick}>
      Unlock
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
const userFilters = [
  <SearchInput source="email" alwaysOn />,
  <SelectInput source="role" choices={[{ id: 'admin', name: 'Admin' }, { id: 'user', name: 'User' }]} />,
];

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
export function UserList() {
  return (
    <List
      filters={userFilters}
      sort={{ field: 'createdAt', order: 'DESC' }}
      actions={<TopToolbar><FilterButton /></TopToolbar>}
    >
      <Datagrid rowClick="edit">
        <TextField source="email" />
        <FunctionField
          label="Role"
          render={(record: { role: string }) => (
            <Chip
              label={record.role}
              color={record.role === 'admin' ? 'primary' : 'default'}
              size="small"
            />
          )}
        />
        <FunctionField
          label="Status"
          render={(record: { isLocked: boolean }) => (
            <Chip
              label={record.isLocked ? 'Locked' : 'Active'}
              color={record.isLocked ? 'error' : 'success'}
              size="small"
            />
          )}
        />
        <TextField source="languageCode" label="Language" />
        <DateField source="createdAt" showTime />
        <EditButton />
        <LockUserButton />
        <UnlockUserButton />
      </Datagrid>
    </List>
  );
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------
export function UserEdit() {
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="email" disabled />
        <SelectInput
          source="role"
          choices={[
            { id: 'user', name: 'User' },
            { id: 'admin', name: 'Admin' },
          ]}
        />
        <TextInput source="languageCode" label="Language Code" />
        <ReferenceInput source="userGroupId" reference="user-groups">
          <SelectInput optionText="name" emptyText="None" />
        </ReferenceInput>
        <ReferenceInput source="subscriptionId" reference="subscriptions">
          <SelectInput optionText="name" emptyText="None" />
        </ReferenceInput>

        <Box mt={2}>
          <Stack direction="row" spacing={1}>
            <LockUserButton />
            <UnlockUserButton />
          </Stack>
        </Box>
      </SimpleForm>
    </Edit>
  );
}
