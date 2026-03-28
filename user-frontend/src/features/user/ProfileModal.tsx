import { useAuthStore } from '@/features/auth/authStore';
import { useUIStore } from '@/shared/stores/uiStore';

export default function ProfileModal() {
  const user = useAuthStore((s) => s.user);
  const closeModal = useUIStore((s) => s.closeModal);

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
          <h2>Profile</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <dl className="profile-dl">
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Provider</dt>
            <dd>{user.provider}</dd>
            {user.role && (
              <>
                <dt>Role</dt>
                <dd>{user.role}</dd>
              </>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
