import { useParams } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from '@/features/sessions/Sidebar';
import ChatThread from './ChatThread';
import NewChatModal from '@/features/bots/NewChatModal';
import ProfileModal from '@/features/user/ProfileModal';
import ClientMemoryModal from '@/features/user/ClientMemoryModal';
import { useUIStore } from '@/shared/stores/uiStore';

export default function ChatPage() {
  const { sessionId } = useParams();
  const activeModal = useUIStore((s) => s.activeModal);

  return (
    <div className="chat-layout">
      <Sidebar />
      <div className="chat-main">
        <TopBar />
        {sessionId ? (
          <ChatThread sessionId={sessionId} />
        ) : (
          <div className="chat-placeholder">
            <h2>Select a conversation or start a new chat</h2>
          </div>
        )}
      </div>

      {activeModal === 'newChat' && <NewChatModal />}
      {activeModal === 'profile' && <ProfileModal />}
      {activeModal === 'memory' && <ClientMemoryModal />}
    </div>
  );
}
