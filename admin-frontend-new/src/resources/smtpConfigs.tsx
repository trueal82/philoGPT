import {
  List,
  Datagrid,
  TextField,
  NumberField,
  BooleanField,
  EditButton,
  Create,
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  NumberInput,
  BooleanInput,
  useDataProvider,
  useNotify,
} from 'react-admin';
import { Button } from '@mui/material';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { PhiloDataProvider } from '../dataProvider';

const tlsModeChoices = [
  { id: 'none', name: 'None' },
  { id: 'starttls', name: 'STARTTLS' },
  { id: 'ssl', name: 'SSL/TLS' },
];

function SmtpTestButton() {
  const notify = useNotify();
  const dataProvider = useDataProvider() as unknown as PhiloDataProvider;
  const form = useFormContext();
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    const values = form.getValues() as Record<string, unknown>;
    setIsTesting(true);
    try {
      const payload = {
        configId: values.id,
        smtpHost: values.smtpHost,
        smtpPort: values.smtpPort,
        tlsMode: values.tlsMode,
        smtpUser: values.smtpUser,
        smtpPassword: values.smtpPassword,
        fromEmail: values.fromEmail,
        fromName: values.fromName,
      };
      await dataProvider.testSmtpConfig(payload);
      notify('Test email sent to your account', { type: 'success' });
    } catch (error: any) {
      notify(error?.message || 'Failed to send test email', { type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Button variant="outlined" onClick={handleTest} disabled={isTesting}>
      {isTesting ? 'Testing...' : 'Test'}
    </Button>
  );
}

export function SmtpConfigList() {
  return (
    <List sort={{ field: 'createdAt', order: 'DESC' }}>
      <Datagrid rowClick="edit">
        <TextField source="name" />
        <TextField source="smtpHost" label="Host" />
        <NumberField source="smtpPort" label="Port" />
        <TextField source="tlsMode" label="TLS" />
        <TextField source="fromEmail" label="From" />
        <BooleanField source="isActive" />
        <EditButton />
      </Datagrid>
    </List>
  );
}

function SmtpConfigForm() {
  return (
    <>
      <TextInput source="name" fullWidth />
      <TextInput source="smtpHost" label="SMTP Host" fullWidth />
      <NumberInput source="smtpPort" label="SMTP Port" defaultValue={587} />
      <SelectInput source="tlsMode" label="TLS Mode" choices={tlsModeChoices} defaultValue="starttls" />
      <TextInput source="smtpUser" label="Username" fullWidth />
      <TextInput source="smtpPassword" label="Password (leave blank to keep current)" fullWidth />
      <TextInput source="fromEmail" label="From Email" fullWidth />
      <TextInput source="fromName" label="From Name" fullWidth />
      <BooleanInput source="isActive" />
      <SmtpTestButton />
    </>
  );
}

export function SmtpConfigCreate() {
  return (
    <Create>
      <SimpleForm>
        <SmtpConfigForm />
      </SimpleForm>
    </Create>
  );
}

export function SmtpConfigEdit() {
  return (
    <Edit>
      <SimpleForm>
        <SmtpConfigForm />
      </SimpleForm>
    </Edit>
  );
}
