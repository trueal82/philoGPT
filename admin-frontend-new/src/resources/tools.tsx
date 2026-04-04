import {
  List,
  Datagrid,
  TextField,
  BooleanField,
  EditButton,
  Create,
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  BooleanInput,
  NumberInput,
  useRecordContext,
  useDataProvider,
  useNotify,
  useRefresh,
  Button,
} from 'react-admin';
import type { PhiloDataProvider } from '../dataProvider';

const toolTypes = [
  { id: 'wikipedia', name: 'Wikipedia' },
  { id: 'client_memory', name: 'Client Memory' },
  { id: 'counseling_plan', name: 'Counseling Plan' },
];

function ToggleToolButton() {
  const record = useRecordContext<{ id: string; enabled: boolean }>();
  const dataProvider = useDataProvider() as PhiloDataProvider;
  const notify = useNotify();
  const refresh = useRefresh();

  if (!record?.id) return null;

  const handleToggle = async () => {
    try {
      await dataProvider.toggleTool(record.id);
      notify('Tool toggled', { type: 'success' });
      refresh();
    } catch {
      notify('Failed to toggle tool', { type: 'error' });
    }
  };

  return (
    <Button label={record.enabled ? 'Disable' : 'Enable'} onClick={handleToggle} />
  );
}

export function ToolList() {
  return (
    <List sort={{ field: 'name', order: 'ASC' }}>
      <Datagrid rowClick="edit">
        <TextField source="name" />
        <TextField source="displayName" />
        <TextField source="type" />
        <BooleanField source="enabled" />
        <EditButton />
        <ToggleToolButton />
      </Datagrid>
    </List>
  );
}

function ToolForm() {
  return (
    <>
      <TextInput source="name" fullWidth />
      <TextInput source="displayName" fullWidth />
      <TextInput source="description" fullWidth multiline minRows={3} />
      <SelectInput source="type" choices={toolTypes} />
      <BooleanInput source="enabled" />
      <NumberInput source="config.maxResults" label="Max Results" />
      <TextInput source="config.language" label="Language" />
    </>
  );
}

export function ToolCreate() {
  return (
    <Create>
      <SimpleForm>
        <ToolForm />
      </SimpleForm>
    </Create>
  );
}

export function ToolEdit() {
  return (
    <Edit>
      <SimpleForm>
        <ToolForm />
      </SimpleForm>
    </Edit>
  );
}
