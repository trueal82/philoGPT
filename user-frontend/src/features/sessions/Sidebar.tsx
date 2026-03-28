import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { ChatSession, Bot } from '@/shared/types';
import * as api from '@/shared/api/endpoints';
import { useUIStore } from '@/shared/stores/uiStore';

function sessionLabel(session: ChatSession): string {
  const bot = session.botId as Bot | undefined;
  const name = typeof session.botId === 'object' ? bot?.name : undefined;
  if (session.title) return session.title;
  if (name) return name;
  return 'Chat';
}

export default function Sidebar() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const openModal = useUIStore((s) => s.openModal);

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
    <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <button
          className="new-chat-btn"
          onClick={() => openModal('newChat')}
          aria-label="New chat"
        >
          + New Chat
        </button>
      </div>

      <nav className="session-list" aria-label="Chat sessions">
        {isLoading && <p className="sidebar-empty">Loading…</p>}
        {!isLoading && sessions.length === 0 && (
          <p className="sidebar-empty">No conversations yet</p>
        )}
        {sessions.map((s) => (
          <div
            key={s._id}
            className={`session-item ${s._id === sessionId ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/chat/${s._id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate(`/chat/${s._id}`);
            }}
          >
            <span className="session-label">{sessionLabel(s)}</span>
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
  );
}
