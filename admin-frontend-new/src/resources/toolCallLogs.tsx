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
} from 'react-admin';

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
        <TextField source="status" />
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
        <TextField source="sessionId" />
        <TextField source="userId" />
        <TextField source="botId" />
        <TextField source="botName" />
        <TextField source="toolName" />
        <TextField source="toolDisplayName" />
        <TextField source="status" />
        <NumberField source="executionTimeMs" label="Time (ms)" />
        <FunctionField
          label="Input params"
          render={(record) => (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatAny(record?.inputParams)}</pre>
          )}
        />
        <FunctionField
          label="Output result"
          render={(record) => (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatAny(record?.outputResult)}</pre>
          )}
        />
        <TextField source="errorMessage" />
      </SimpleShowLayout>
    </Show>
  );
}
