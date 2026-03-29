import { useEffect, useState } from 'react';
import { useDataProvider, useNotify, useAuthenticated } from 'react-admin';
import { Box, Button, Card, CardContent, CardHeader, Stack, TextField, Typography } from '@mui/material';
import type { PhiloDataProvider } from '../dataProvider';

export default function SystemPromptPage() {
  useAuthenticated();
  const dataProvider = useDataProvider() as PhiloDataProvider;
  const notify = useNotify();

  const [content, setContent] = useState('');
  const [locales, setLocales] = useState<Record<string, string>>({});
  const [newLang, setNewLang] = useState('');
  const [newContent, setNewContent] = useState('');

  const load = async () => {
    try {
      const res = await dataProvider.getSystemPrompt();
      const prompt = (res.data || {}) as { content?: string; locales?: Record<string, string> };
      setContent(prompt.content || '');
      setLocales(prompt.locales || {});
    } catch {
      notify('Failed to load system prompt', { type: 'error' });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDefault = async () => {
    try {
      await dataProvider.saveSystemPrompt(content);
      notify('System prompt saved', { type: 'success' });
      await load();
    } catch {
      notify('Failed to save system prompt', { type: 'error' });
    }
  };

  const saveLocale = async () => {
    if (!newLang || !newContent) {
      notify('Language and content are required', { type: 'warning' });
      return;
    }
    try {
      await dataProvider.saveSystemPromptLocale(newLang, newContent);
      notify('Locale saved', { type: 'success' });
      setNewLang('');
      setNewContent('');
      await load();
    } catch {
      notify('Failed to save locale', { type: 'error' });
    }
  };

  const deleteLocale = async (lang: string) => {
    try {
      await dataProvider.deleteSystemPromptLocale(lang);
      notify('Locale deleted', { type: 'success' });
      await load();
    } catch {
      notify('Failed to delete locale', { type: 'error' });
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Card sx={{ mb: 2 }}>
        <CardHeader title="Default System Prompt" />
        <CardContent>
          <Stack spacing={2}>
            <TextField
              fullWidth
              multiline
              minRows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <Button variant="contained" onClick={saveDefault}>
              Save Default Prompt
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Localized Prompts" />
        <CardContent>
          <Stack spacing={2}>
            {Object.entries(locales).map(([lang, value]) => (
              <Box key={lang} sx={{ border: '1px solid #ddd', borderRadius: 1, p: 1 }}>
                <Typography variant="subtitle2">{lang.toUpperCase()}</Typography>
                <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                  {value}
                </Typography>
                <Button size="small" color="error" onClick={() => deleteLocale(lang)}>
                  Delete
                </Button>
              </Box>
            ))}

            <Typography variant="h6" sx={{ mt: 1 }}>
              Add / Update Locale
            </Typography>
            <TextField label="Language Code" value={newLang} onChange={(e) => setNewLang(e.target.value)} />
            <TextField
              label="Localized Prompt"
              multiline
              minRows={6}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
            <Button variant="contained" onClick={saveLocale}>
              Save Locale
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
