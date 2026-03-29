import { useAuthStore } from '@/features/auth/authStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/shared/api/endpoints';

export default function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateUserLanguage = useAuthStore((s) => s.updateLanguage);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openModal = useUIStore((s) => s.openModal);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: langData } = useQuery({
    queryKey: ['languages'],
    queryFn: api.getLanguages,
    staleTime: 5 * 60 * 1000,
  });

  const langMut = useMutation({
    mutationFn: api.updateLanguage,
    onSuccess: (_data, code) => {
      updateUserLanguage(code);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="top-bar">
      <button
        className="hamburger-btn"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>
      <h1 className="top-bar-title">PhiloGPT</h1>
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <div className="user-menu" ref={menuRef}>
        <button
          className="user-menu-trigger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          {user?.email ?? t('common.user')}
        </button>
        {menuOpen && (
          <div className="user-menu-dropdown" role="menu">
            <button
              role="menuitem"
              onClick={() => { openModal('profile'); setMenuOpen(false); }}
            >
              {t('nav.profile')}
            </button>
            {user?.provider === 'local' && (
              <button
                role="menuitem"
                onClick={() => { openModal('changePassword'); setMenuOpen(false); }}
              >
                {t('modal.changePassword')}
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => { openModal('memory'); setMenuOpen(false); }}
            >
              {t('nav.myMemory')}
            </button>
            {langData && langData.languages.length > 0 && (
              <>
                <hr />
                <div className="language-row">
                  <label htmlFor="lang-select">🌐</label>
                  <select
                    id="lang-select"
                    className="language-select"
                    value={user?.languageCode ?? 'en-us'}
                    onChange={(e) => langMut.mutate(e.target.value)}
                    disabled={langMut.isPending}
                  >
                    {langData.languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.nativeName}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <hr />
            <button
              role="menuitem"
              onClick={() => { logout(); }}
            >
              {t('auth.signOut')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
