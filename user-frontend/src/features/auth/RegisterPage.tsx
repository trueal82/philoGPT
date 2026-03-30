import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './authStore';
import { normalizeLanguageCode, setUILanguage, SUPPORTED_UI_LANGUAGES } from '@/i18n';

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const uiLanguage = normalizeLanguageCode(i18n.resolvedLanguage ?? i18n.language);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [localError, setLocalError] = useState('');
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setLocalError(t('auth.passwordMismatch'));
      return;
    }
    setLocalError('');
    try {
      const msg = await register(email, password);
      setSuccessMsg(msg);
    } catch {
      // error is already set in store
    }
  };

  if (successMsg) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>PhiloGPT</h1>
          <p className="auth-subtitle">{t('auth.accountCreated')}</p>
          <p className="auth-success">{successMsg}</p>
          <p className="auth-link">
            <Link to="/login">{t('auth.signIn')}</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-lang-switcher">
          <select
            className="language-select"
            value={uiLanguage}
            onChange={(e) => setUILanguage(e.target.value)}
            aria-label={t('nav.language')}
          >
            {SUPPORTED_UI_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <h1>PhiloGPT</h1>
        <p className="auth-subtitle">{t('auth.registerSubtitle')}</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">{t('common.email')}</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <label htmlFor="password">{t('common.password')}</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.passwordHint')}
          />
          <label htmlFor="confirm">{t('auth.confirmPassword')}</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
          />
          {(localError || error) && (
            <p className="auth-error">{localError || error}</p>
          )}
          <button type="submit" disabled={loading}>
            {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
          </button>
        </form>
        <p className="auth-link">
          {t('auth.hasAccount')} <Link to="/login">{t('auth.signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
