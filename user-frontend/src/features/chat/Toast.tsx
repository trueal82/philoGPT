import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getSocket } from '@/shared/api/socket';
import { dismissToast, showToast, useToastStore } from '@/shared/stores/toastStore';

export default function Toast() {
  const { t } = useTranslation();
  const toasts = useToastStore((s) => s.toasts);

  const dismiss = useCallback((id: number) => {
    dismissToast(id);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onMemory = (payload: { key: string; value: string }) => {
      showToast({ kind: 'memory', key: payload.key, value: payload.value }, 5000);
    };

    socket.on('memory:created', onMemory);
    return () => { socket.off('memory:created', onMemory); };
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((item) => (
        <div key={item.id} className={`toast-item toast-${item.kind}`}>
          <span className="toast-text">
            {item.kind === 'memory'
              ? <>{t('toast.memoryCreated')} <strong>{item.key}</strong></>
              : item.message}
          </span>
          <button className="toast-close" onClick={() => dismiss(item.id)} aria-label="Close">×</button>
        </div>
      ))}
    </div>
  );
}
