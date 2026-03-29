import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Shows a banner prompting the user to install the PWA.
 *
 * On Android/Chrome the native `beforeinstallprompt` event fires and we
 * can trigger the real browser install dialog.
 *
 * On iOS Safari there is no such event, so we detect standalone-capable
 * Safari and show a manual instruction instead.
 */
export default function InstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed as standalone
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((navigator as any).standalone) return; // iOS standalone

    // Check localStorage — only show once per 7 days after dismiss
    const lastDismissed = localStorage.getItem('pwa-install-dismissed');
    if (lastDismissed && Date.now() - Number(lastDismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Android/Chrome: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari detection
    const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent);
    const isSafari = /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|Chrome/i.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setShowIOSHint(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSHint(false);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  };

  if (dismissed) return null;
  if (!deferredPrompt && !showIOSHint) return null;

  return (
    <div className="install-banner">
      <div className="install-banner-content">
        <strong>{t('pwa.installTitle')}</strong>
        <p>
          {showIOSHint && !deferredPrompt
            ? t('pwa.installMessage') + ' Tap the share button, then "Add to Home Screen".'
            : t('pwa.installMessage')}
        </p>
      </div>
      <div className="install-banner-actions">
        {deferredPrompt && (
          <button className="btn-primary" onClick={handleInstall}>
            {t('pwa.installButton')}
          </button>
        )}
        <button className="install-dismiss" onClick={handleDismiss}>
          {t('pwa.dismiss')}
        </button>
      </div>
    </div>
  );
}
