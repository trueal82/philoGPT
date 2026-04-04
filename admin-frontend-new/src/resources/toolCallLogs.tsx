import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  Show,
  SimpleShowLayout,
  ShowButton,
  FunctionField,
  ReferenceField,
} from 'react-admin';
import { Chip } from '@mui/material';

function formatAny(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolCallLogList() {
  return (
    <List sort={{ field: 'createdAt', order: 'DESC' }} exporter={false}>
      <Datagrid rowClick="show" bulkActionButtons={false}>
        <DateField source="createdAt" showTime />
        <TextField source="botName" label="Bot" />
        <TextField source="toolName" label="Tool" />
        <FunctionField
          label="Status"
          render={(record: any) => (
            <Chip
              label={record?.status}
              color={record?.status === 'success' ? 'success' : record?.status === 'error' ? 'error' : 'default'}
              size="small"
            />
          )}
        />
        <NumberField source="executionTimeMs" label="Time (ms)" />
        <ShowButton />
      </Datagrid>
    </List>
  );
}

export function ToolCallLogShow() {
  return (
    <Show>
      <SimpleShowLayout>
        <DateField source="createdAt" showTime />
        <ReferenceField source="userId" reference="users" link={false}><TextField source="email" /></ReferenceField>
        <ReferenceField source="botId" reference="bots" link={false}><TextField source="name" /></ReferenceField>
        <TextField source="sessionId" label="Session ID" />
        <TextField source="toolName" />
        <TextField source="toolDisplayName" />
        <FunctionField
          label="Status"
          render={(record: any) => (
            <Chip
              label={record?.status}
              color={record?.status === 'success' ? 'success' : record?.status === 'error' ? 'error' : 'default'}
              size="small"
            />
          )}
        />
        <NumberField source="executionTimeMs" label="Time (ms)" />
        <FunctionField
          label="Input params"
          render={(record: any) => (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatAny(record?.inputParams)}</pre>
          )}
        />
        <FunctionField
          label="Output result"
          render={(record: any) => (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatAny(record?.outputResult)}</pre>
          )}
        />
        <TextField source="errorMessage" />
      </SimpleShowLayout>
    </Show>
  );
}
