import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { router } from './router';
import { useAuthStore } from '@/features/auth/authStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  const token = useAuthStore((s) => s.token);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const languageCode = useAuthStore((s) => s.user?.languageCode);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (token) {
      loadProfile();
    }
  }, [token, loadProfile]);

  useEffect(() => {
    i18n.changeLanguage(languageCode ?? 'en-us');
  }, [languageCode, i18n]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
