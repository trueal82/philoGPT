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
  DeleteButton,
  BulkDeleteButton,
  useRecordContext,
} from 'react-admin';
import { Chip, Typography } from '@mui/material';
import Box from '@mui/material/Box';

function formatAny(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function DurationField() {
  const record = useRecordContext();
  if (!record?.stats?.durationMs) return null;
  return <span>{record.stats.durationMs.toLocaleString()} ms</span>;
}

export function LLMLogList() {
  return (
    <List
      sort={{ field: 'createdAt', order: 'DESC' }}
      exporter={false}
      perPage={50}
    >
      <Datagrid rowClick="show" bulkActionButtons={<BulkDeleteButton />}>
        <DateField source="createdAt" showTime />
        <TextField source="botName" label="Bot" />
        <TextField source="model" label="Model" />
        <FunctionField
          label="Type"
          render={(record: any) => (
            <Chip
              label={record?.responseType}
              color={record?.responseType === 'response' ? 'success' : 'info'}
              size="small"
            />
          )}
        />
        <NumberField source="toolRound" label="Round" />
        <FunctionField label="Duration" render={() => <DurationField />} />
        <ShowButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}

function RequestMessagesField() {
  const record = useRecordContext();
  if (!record?.requestMessages?.length) return <Typography variant="body2">No messages</Typography>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {record.requestMessages.map((msg: any, i: number) => (
        <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase', color:
            msg.role === 'system' ? 'warning.main' :
            msg.role === 'user' ? 'info.main' :
            msg.role === 'assistant' ? 'success.main' :
            'text.secondary'
          }}>
            {msg.role}
          </Typography>
          <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
            {typeof msg.content === 'string' ? msg.content.slice(0, 2000) : formatAny(msg.content)}
            {typeof msg.content === 'string' && msg.content.length > 2000 ? '\n... (truncated)' : ''}
          </pre>
          {msg.tool_calls && (
            <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#888' }}>
              tool_calls: {formatAny(msg.tool_calls)}
            </pre>
          )}
        </Box>
      ))}
    </Box>
  );
}

export function LLMLogShow() {
  return (
    <Show>
      <SimpleShowLayout>
        <DateField source="createdAt" showTime />
        <ReferenceField source="userId" reference="users" link={false}><TextField source="email" /></ReferenceField>
        <ReferenceField source="botId" reference="bots" link={false}><TextField source="name" /></ReferenceField>
        <TextField source="sessionId" label="Session ID" />
        <TextField source="botName" label="Bot Name" />
        <TextField source="model" />
        <TextField source="provider" />
        <NumberField source="toolRound" label="Tool Round" />
        <FunctionField
          label="Response Type"
          render={(record: any) => (
            <Chip
              label={record?.responseType}
              color={record?.responseType === 'response' ? 'success' : 'info'}
              size="small"
            />
          )}
        />

        <FunctionField
          label="Stats"
          render={(record: any) => {
            const s = record?.stats;
            if (!s) return null;
            const parts: string[] = [];
            if (s.durationMs) parts.push(`Duration: ${s.durationMs.toLocaleString()} ms`);
            if (s.tokensPerSecond) parts.push(`Tokens/sec: ${s.tokensPerSecond}`);
            if (s.evalTokens) parts.push(`Eval tokens: ${s.evalTokens}`);
            if (s.promptTokens) parts.push(`Prompt tokens: ${s.promptTokens}`);
            return <span>{parts.join(' · ')}</span>;
          }}
        />

        <FunctionField
          label="Request Messages"
          render={() => <RequestMessagesField />}
        />

        <FunctionField
          label="Response Content"
          render={(record: any) => (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{record?.responseContent || '(empty)'}</pre>
          )}
        />

        {/* Tool calls (only if present) */}
        <FunctionField
          label="Response Tool Calls"
          render={(record: any) =>
            record?.responseToolCalls?.length > 0 ? (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatAny(record.responseToolCalls)}</pre>
            ) : null
          }
        />

        {/* Thinking (only if present) */}
        <FunctionField
          label="Thinking"
          render={(record: any) =>
            record?.thinkingContent ? (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#888' }}>{record.thinkingContent}</pre>
            ) : null
          }
        />

        <DeleteButton />
      </SimpleShowLayout>
    </Show>
  );
}
