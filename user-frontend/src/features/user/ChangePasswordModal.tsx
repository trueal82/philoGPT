import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as api from '@/shared/api/endpoints';
import { useUIStore } from '@/shared/stores/uiStore';

export default function ChangePasswordModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [clientError, setClientError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword, confirmPassword),
    onSuccess: () => {
      setSuccessMsg(t('modal.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setClientError('');
    },
    onError: (err: Error) => {
      setClientError(err.message);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setClientError('');

    if (newPassword !== confirmPassword) {
      setClientError(t('auth.passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setClientError(t('auth.passwordHint'));
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className="modal-content modal-sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t('modal.changePasswordTitle')}
      >
        <div className="modal-header">
          <h2>{t('modal.changePasswordTitle')}</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="change-password-form">
            <label className="form-label">
              {t('modal.currentPassword')}
              <input
                type="password"
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="form-label">
              {t('modal.newPassword')}
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="form-label">
              {t('modal.confirmNewPassword')}
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            {clientError && <p className="form-error">{clientError}</p>}
            {mutation.error && !clientError && (
              <p className="form-error">{(mutation.error as Error).message}</p>
            )}
            {successMsg && <p className="form-success">{successMsg}</p>}

            <div className="modal-footer">
              <button
                type="submit"
                className="btn-primary"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? t('modal.saving') : t('modal.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
