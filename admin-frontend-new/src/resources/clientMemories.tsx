import {
  List,
  Datagrid,
  TextField,
  EditButton,
  Create,
  Edit,
  SimpleForm,
  TextInput,
  ReferenceInput,
  SelectInput,
  FunctionField,
  DateField,
} from 'react-admin';

function parseJsonOrThrow(value: string): Record<string, unknown> {
  if (!value || value.trim() === '') return {};
  return JSON.parse(value);
}

export function ClientMemoryList() {
  return (
    <List sort={{ field: 'createdAt', order: 'DESC' }}>
      <Datagrid rowClick="edit">
        <TextField source="userId.email" label="User" />
        <TextField source="botId.name" label="Bot" />
        <FunctionField
          label="Data preview"
          render={(record: { data: unknown }) => JSON.stringify(record.data || {}).slice(0, 120)}
        />
        <DateField source="createdAt" showTime />
        <EditButton />
      </Datagrid>
    </List>
  );
}

export function ClientMemoryCreate() {
  return (
    <Create
      transform={(data) => ({
        ...data,
        data: typeof data.data === 'string' ? parseJsonOrThrow(data.data) : data.data,
      })}
    >
      <SimpleForm>
        <ReferenceInput source="userId" reference="users">
          <SelectInput optionText="email" />
        </ReferenceInput>
        <ReferenceInput source="botId" reference="bots">
          <SelectInput optionText="id" />
        </ReferenceInput>
        <TextInput source="data" label="Data (JSON)" multiline minRows={8} fullWidth />
      </SimpleForm>
    </Create>
  );
}

export function ClientMemoryEdit() {
  return (
    <Edit
      transform={(data) => ({
        ...data,
        data: typeof data.data === 'string' ? parseJsonOrThrow(data.data) : data.data,
      })}
    >
      <SimpleForm>
        <TextField source="userId.email" label="User" />
        <TextField source="botId.name" label="Bot" />
        <TextInput source="data" label="Data (JSON)" multiline minRows={10} fullWidth format={(v) => (typeof v === 'string' ? v : JSON.stringify(v || {}, null, 2))} />
      </SimpleForm>
    </Edit>
  );
}
