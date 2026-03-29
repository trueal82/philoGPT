import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getSocket } from '@/shared/api/socket';

interface ToastItem {
  id: number;
  key: string;
  value: string;
}

let nextId = 0;

export default function Toast() {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onMemory = (payload: { key: string; value: string }) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, key: payload.key, value: payload.value }]);
      setTimeout(() => dismiss(id), 5000);
    };

    socket.on('memory:created', onMemory);
    return () => { socket.off('memory:created', onMemory); };
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((item) => (
        <div key={item.id} className="toast-item">
          <span className="toast-text">
            {t('toast.memoryCreated')} <strong>{item.key}</strong>
          </span>
          <button className="toast-close" onClick={() => dismiss(item.id)} aria-label="Close">×</button>
        </div>
      ))}
    </div>
  );
}
