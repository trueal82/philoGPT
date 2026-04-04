import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopBar from './TopBar';
import Toast from './Toast';
import Sidebar from '@/features/sessions/Sidebar';
import ChatThread from './ChatThread';
import NewChatModal from '@/features/bots/NewChatModal';
import ProfileModal from '@/features/user/ProfileModal';
import ClientMemoryModal from '@/features/user/ClientMemoryModal';
import ChangePasswordModal from '@/features/user/ChangePasswordModal';
import InstallPrompt from '@/features/pwa/InstallPrompt';
import CounselingPlanModal from './CounselingPlanModal';
import { useUIStore } from '@/shared/stores/uiStore';

export default function ChatPage() {
  const { sessionId } = useParams();
  const activeModal = useUIStore((s) => s.activeModal);
  const { t } = useTranslation();

  return (
    <div className="chat-layout">
      <Sidebar />
      <div className="chat-main">
        <TopBar />
        {sessionId ? (
          <ChatThread sessionId={sessionId} />
        ) : (
          <div className="chat-placeholder">
            <h2>{t('chat.placeholderText')}</h2>
          </div>
        )}
      </div>

      {activeModal === 'newChat' && <NewChatModal />}
      {activeModal === 'profile' && <ProfileModal />}
      {activeModal === 'memory' && <ClientMemoryModal />}
      {activeModal === 'changePassword' && <ChangePasswordModal />}
      {activeModal === 'counselingPlan' && sessionId && <CounselingPlanModal sessionId={sessionId} />}
      <InstallPrompt />
      <Toast />
    </div>
  );
}
