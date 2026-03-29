import { useEffect, useState } from 'react';
import {
  List,
  Datagrid,
  TextField as RaTextField,
  DateField,
  EditButton,
  Create,
  Edit,
  SimpleForm,
  TextInput,
  ReferenceArrayInput,
  SelectArrayInput,
  useDataProvider,
  useNotify,
  useRecordContext,
  useGetList,
} from 'react-admin';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { PhiloDataProvider } from '../dataProvider';

interface LocaleFormState {
  id?: string;
  languageCode: string;
  systemPrompt: string;
  name: string;
  description: string;
  personality: string;
}

function createEmptyLocale(languageCode = ''): LocaleFormState {
  return {
    languageCode,
    systemPrompt: '',
    name: '',
    description: '',
    personality: '',
  };
}

function BotLocalesManager() {
  const record = useRecordContext<{ id: string }>();
  const dataProvider = useDataProvider() as PhiloDataProvider;
  const notify = useNotify();
  const [locales, setLocales] = useState<LocaleFormState[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<LocaleFormState>(createEmptyLocale());

  const { data: languages } = useGetList('languages', {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: 'sortOrder', order: 'ASC' },
    filter: {},
  });

  const loadLocales = async () => {
    if (!record?.id) return;
    try {
      const res = await dataProvider.getBotLocales(record.id);
      const nextLocales = (res.data as Array<Record<string, unknown>>).map((locale) => ({
        id: String(locale.id || ''),
        languageCode: String(locale.languageCode || ''),
        systemPrompt: String(locale.systemPrompt || ''),
        name: String(locale.name || ''),
        description: String(locale.description || ''),
        personality: String(locale.personality || ''),
      }));
      setLocales(nextLocales);
      setActiveTab((current) => {
        if (nextLocales.length === 0) return '';
        if (current && nextLocales.some((locale) => locale.languageCode === current)) return current;
        return nextLocales[0].languageCode;
      });
    } catch {
      notify('Failed to load locales', { type: 'error' });
    }
  };

  useEffect(() => {
    loadLocales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  if (!record?.id) return null;

  const handleLocaleFieldChange = (languageCode: string, field: keyof LocaleFormState, value: string) => {
    setLocales((current) => current.map((locale) => (
      locale.languageCode === languageCode ? { ...locale, [field]: value } : locale
    )));
  };

  const handleSaveExisting = async (locale: LocaleFormState) => {
    if (!locale.languageCode || !locale.systemPrompt) {
      notify('languageCode and systemPrompt are required', { type: 'warning' });
      return;
    }
    try {
      await dataProvider.saveBotLocale(record.id, locale.languageCode, {
        name: locale.name || undefined,
        description: locale.description || undefined,
        personality: locale.personality || undefined,
        systemPrompt: locale.systemPrompt,
      });
      notify('Locale saved', { type: 'success' });
      await loadLocales();
    } catch {
      notify('Failed to save locale', { type: 'error' });
    }
  };

  const handleCreate = async () => {
    if (!createForm.languageCode || !createForm.systemPrompt) {
      notify('languageCode and systemPrompt are required', { type: 'warning' });
      return;
    }
    try {
      await dataProvider.saveBotLocale(record.id, createForm.languageCode, {
        name: createForm.name || undefined,
        description: createForm.description || undefined,
        personality: createForm.personality || undefined,
        systemPrompt: createForm.systemPrompt,
      });
      notify('Locale created', { type: 'success' });
      setIsCreateOpen(false);
      setCreateForm(createEmptyLocale());
      await loadLocales();
      setActiveTab(createForm.languageCode);
    } catch {
      notify('Failed to create locale', { type: 'error' });
    }
  };

  const handleDelete = async (languageCode: string) => {
    try {
      await dataProvider.deleteBotLocale(record.id, languageCode);
      notify('Locale deleted', { type: 'success' });
      await loadLocales();
    } catch {
      notify('Failed to delete locale', { type: 'error' });
    }
  };

  const activeLocale = locales.find((locale) => locale.languageCode === activeTab) || null;
  const availableLanguageChoices = (languages || []).map((language) => ({
    code: String(language.code),
    label: String(language.nativeName || language.name || language.code),
  }));
  const languageLabelMap = new Map(
    availableLanguageChoices.map((language) => [language.code, language.label]),
  );

  return (
    <Card sx={{ mt: 2 }}>
      <CardHeader
        title="Bot Locales"
        action={
          <Button variant="contained" onClick={() => setIsCreateOpen(true)}>
            Add Locale
          </Button>
        }
      />
      <CardContent>
        {locales.length === 0 ? (
          <Alert severity="info">No locales yet. Use “Add Locale” to create one.</Alert>
        ) : (
          <Stack spacing={2}>
            <Tabs
              value={activeTab}
              onChange={(_event, nextValue) => setActiveTab(nextValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {locales.map((locale) => (
                <Tab
                  key={locale.languageCode}
                  value={locale.languageCode}
                  label={languageLabelMap.get(locale.languageCode) || locale.languageCode.toUpperCase()}
                />
              ))}
            </Tabs>

            {activeLocale ? (
              <Stack spacing={2}>
                <Typography variant="subtitle2" color="text.secondary">
                  Language: {activeLocale.languageCode.toUpperCase()}
                </Typography>
                <TextField
                  label="Localized Name"
                  value={activeLocale.name}
                  onChange={(e) => handleLocaleFieldChange(activeLocale.languageCode, 'name', e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Description"
                  value={activeLocale.description}
                  onChange={(e) => handleLocaleFieldChange(activeLocale.languageCode, 'description', e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                />
                <TextField
                  label="Personality"
                  value={activeLocale.personality}
                  onChange={(e) => handleLocaleFieldChange(activeLocale.languageCode, 'personality', e.target.value)}
                  fullWidth
                  multiline
                  minRows={4}
                />
                <TextField
                  label="System Prompt"
                  value={activeLocale.systemPrompt}
                  onChange={(e) => handleLocaleFieldChange(activeLocale.languageCode, 'systemPrompt', e.target.value)}
                  fullWidth
                  multiline
                  minRows={8}
                />
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={() => handleSaveExisting(activeLocale)}>
                    Save Locale
                  </Button>
                  <Button color="error" onClick={() => handleDelete(activeLocale.languageCode)}>
                    Delete Locale
                  </Button>
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        )}

        <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>Add Bot Locale</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                select
                label="Language"
                value={createForm.languageCode}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, languageCode: e.target.value }))}
                fullWidth
              >
                {availableLanguageChoices.map((language) => (
                  <MenuItem key={language.code} value={language.code}>
                    {language.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Localized Name"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Description"
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                minRows={3}
              />
              <TextField
                label="Personality"
                value={createForm.personality}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, personality: e.target.value }))}
                fullWidth
                multiline
                minRows={4}
              />
              <TextField
                label="System Prompt"
                value={createForm.systemPrompt}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                fullWidth
                multiline
                minRows={8}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreate}>Create Locale</Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export function BotList() {
  return (
    <List sort={{ field: 'createdAt', order: 'DESC' }}>
      <Datagrid rowClick="edit">
        <RaTextField source="name" label="Name (en-us)" />
        <RaTextField source="avatar" />
        <RaTextField source="description" />
        <DateField source="createdAt" showTime />
        <EditButton />
      </Datagrid>
    </List>
  );
}

export function BotCreate() {
  return (
    <Create>
      <SimpleForm>
        <TextInput source="avatar" fullWidth />
        <ReferenceArrayInput source="availableToSubscriptionIds" reference="subscriptions">
          <SelectArrayInput optionText="name" />
        </ReferenceArrayInput>
      </SimpleForm>
    </Create>
  );
}

export function BotEdit() {
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="avatar" fullWidth />
        <ReferenceArrayInput source="availableToSubscriptionIds" reference="subscriptions">
          <SelectArrayInput optionText="name" />
        </ReferenceArrayInput>
        <BotLocalesManager />
      </SimpleForm>
    </Edit>
  );
}
