import { useEffect, useState } from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  Show,
  SimpleShowLayout,
  useDataProvider,
  useRecordContext,
  useNotify,
  DeleteButton,
  SearchInput,
  TopToolbar,
  FilterButton,
} from 'react-admin';
import { Box, Chip, Typography } from '@mui/material';
import type { PhiloDataProvider } from '../dataProvider';

function SessionMessages() {
  const record = useRecordContext<{ id: string }>();
  const dataProvider = useDataProvider() as PhiloDataProvider;
  const notify = useNotify();
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function run() {
      if (!record?.id) return;
      try {
        const res = await dataProvider.getSessionMessages(record.id);
        setMessages(res.data as Array<Record<string, unknown>>);
      } catch {
        notify('Failed to load session messages', { type: 'error' });
      }
    }
    run();
  }, [dataProvider, notify, record?.id]);

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Messages ({messages.length})</Typography>
      {messages.length === 0 && <Typography variant="body2" color="text.secondary">No messages yet</Typography>}
      {messages.map((m, idx) => (
        <Box key={`${String(m.id)}-${idx}`} sx={{ border: '1px solid #ddd', borderRadius: 1, p: 1, mb: 1 }}>
          <Chip
            label={String(m.role)}
            size="small"
            color={m.role === 'assistant' ? 'primary' : m.role === 'user' ? 'default' : 'info'}
            sx={{ mb: 0.5 }}
          />
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{String(m.content || '')}</Typography>
        </Box>
      ))}
    </Box>
  );
}

const sessionFilters = [<SearchInput source="userId" alwaysOn />];

export function SessionList() {
  return (
    <List
      filters={sessionFilters}
      pagination={false}
      perPage={50}
      sort={{ field: 'createdAt', order: 'DESC' }}
      actions={<TopToolbar><FilterButton /></TopToolbar>}
    >
      <Datagrid rowClick="show" bulkActionButtons={false}>
        <TextField source="userId.email" label="User" />
        <TextField source="botId.name" label="Bot" />
        <NumberField source="messageCount" label="Messages" />
        <DateField source="createdAt" label="Started" showTime />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}

export function SessionShow() {
  return (
    <Show>
      <SimpleShowLayout>
        <TextField source="id" />
        <TextField source="userId.email" label="User" />
        <TextField source="botId.name" label="Bot" />
        <NumberField source="messageCount" />
        <DateField source="createdAt" showTime />
        <SessionMessages />
      </SimpleShowLayout>
    </Show>
  );
}
