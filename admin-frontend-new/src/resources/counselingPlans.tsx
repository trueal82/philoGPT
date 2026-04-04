import {
  List,
  Datagrid,
  TextField,
  DateField,
  Show,
  SimpleShowLayout,
  ShowButton,
  DeleteButton,
  FunctionField,
  ReferenceField,
} from 'react-admin';
import { Box, Chip, Typography } from '@mui/material';

interface CounselingStep {
  stepId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  evidence?: string;
  createdAt: string;
  completedAt?: string;
}

const statusColor: Record<string, 'default' | 'warning' | 'success'> = {
  pending: 'default',
  in_progress: 'warning',
  completed: 'success',
};

export function CounselingPlanList() {
  return (
    <List sort={{ field: 'updatedAt', order: 'DESC' }} exporter={false} pagination={false} perPage={50}>
      <Datagrid rowClick="show" bulkActionButtons={false}>
        <TextField source="title" />
        <ReferenceField source="userId" reference="users" link={false}><TextField source="email" /></ReferenceField>
        <ReferenceField source="botId" reference="bots" link={false}><TextField source="name" /></ReferenceField>
        <FunctionField label="Steps" render={(record: any) => {
          const steps = record?.steps ?? [];
          const completed = steps.filter((s: any) => s.status === 'completed').length;
          return `${completed}/${steps.length}`;
        }} />
        <DateField source="createdAt" showTime />
        <DateField source="updatedAt" showTime />
        <ShowButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}

export function CounselingPlanShow() {
  return (
    <Show>
      <SimpleShowLayout>
        <TextField source="title" />
        <ReferenceField source="userId" reference="users" link={false}><TextField source="email" /></ReferenceField>
        <ReferenceField source="botId" reference="bots" link={false}><TextField source="name" /></ReferenceField>
        <TextField source="sessionId" label="Session ID" />
        <DateField source="createdAt" showTime />
        <DateField source="updatedAt" showTime />
        <FunctionField
          label="Steps"
          render={(record: any) => {
            const steps: CounselingStep[] = record?.steps ?? [];
            if (steps.length === 0) return <Typography variant="body2" color="text.secondary">No steps</Typography>;
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {steps.map((step, idx) => (
                  <Box key={step.stepId ?? idx} sx={{ border: '1px solid #ddd', borderRadius: 1, p: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2">
                        {idx + 1}. {step.title}
                      </Typography>
                      <Chip
                        label={step.status.replace('_', ' ')}
                        color={statusColor[step.status] ?? 'default'}
                        size="small"
                      />
                    </Box>
                    {step.description && (
                      <Typography variant="body2" color="text.secondary">{step.description}</Typography>
                    )}
                    {step.evidence && (
                      <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                        Evidence: {step.evidence}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Created: {new Date(step.createdAt).toLocaleString()}
                      {step.completedAt && ` · Completed: ${new Date(step.completedAt).toLocaleString()}`}
                    </Typography>
                  </Box>
                ))}
              </Box>
            );
          }}
        />
        <DeleteButton />
      </SimpleShowLayout>
    </Show>
  );
}
