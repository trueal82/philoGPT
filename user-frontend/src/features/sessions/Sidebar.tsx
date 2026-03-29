import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ChatSession, Bot } from '@/shared/types';
import * as api from '@/shared/api/endpoints';
import { useUIStore } from '@/shared/stores/uiStore';

function sessionLabel(session: ChatSession): string {
  const bot = session.botId as Bot | undefined;
  const name = typeof session.botId === 'object' ? bot?.name : undefined;
  if (session.title) return session.title;
  if (name) {
    const startedAt = new Date(session.createdAt);
    const formattedDate = Number.isNaN(startedAt.getTime())
      ? ''
      : startedAt.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
    return formattedDate ? `${name} - ${formattedDate}` : name;
  }
  return '';
}

export default function Sidebar() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openModal = useUIStore((s) => s.openModal);
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.listSessions(),
    select: (d) => d.sessions,
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSession,
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (sessionId === deletedId) {
        navigate('/chat');
      }
    },
  });

  const sessions = data ?? [];

  return (
    <>
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={toggleSidebar} aria-hidden="true" />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <button
          className="new-chat-btn"
          onClick={() => openModal('newChat')}
          aria-label="New chat"
        >
          {t('chat.newChat')}
        </button>
      </div>

      <nav className="session-list" aria-label="Chat sessions">
        {isLoading && <p className="sidebar-empty">{t('common.loading')}</p>}
        {!isLoading && sessions.length === 0 && (
          <p className="sidebar-empty">{t('chat.noConversations')}</p>
        )}
        {sessions.map((s) => (
          <div
            key={s._id}
            className={`session-item ${s._id === sessionId ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              navigate(`/chat/${s._id}`);
              if (window.innerWidth <= 768 && sidebarOpen) toggleSidebar();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate(`/chat/${s._id}`);
                if (window.innerWidth <= 768 && sidebarOpen) toggleSidebar();
              }
            }}
          >
            <span className="session-label">{sessionLabel(s) || t('chat.defaultTitle')}</span>
            <button
              className="session-delete"
              aria-label={`Delete session ${sessionLabel(s)}`}
              onClick={(e) => {
                e.stopPropagation();
                deleteMutation.mutate(s._id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </nav>
      </aside>
    </>
  );
}
