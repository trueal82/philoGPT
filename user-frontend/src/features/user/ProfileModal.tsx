import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/authStore';
import { useUIStore } from '@/shared/stores/uiStore';

export default function ProfileModal() {
  const user = useAuthStore((s) => s.user);
  const closeModal = useUIStore((s) => s.closeModal);
  const { t } = useTranslation();

  if (!user) return null;

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className="modal-content modal-sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Profile"
      >
        <div className="modal-header">
          <h2>{t('modal.profile')}</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <dl className="profile-dl">
            <dt>{t('common.email')}</dt>
            <dd>{user.email}</dd>
            <dt>{t('modal.provider')}</dt>
            <dd>{user.provider}</dd>
            {user.role && (
              <>
                <dt>{t('modal.role')}</dt>
                <dd>{user.role}</dd>
              </>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
