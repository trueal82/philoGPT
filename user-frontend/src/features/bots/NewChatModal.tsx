import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as api from '@/shared/api/endpoints';
import { useUIStore } from '@/shared/stores/uiStore';

export default function NewChatModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: api.listBots,
    select: (d) => d.bots,
  });

  const createMutation = useMutation({
    mutationFn: api.createSession,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      closeModal();
      navigate(`/chat/${res.session._id}`);
      // On mobile, close the sidebar so the chat + input are fully visible
      if (window.innerWidth <= 768 && sidebarOpen) toggleSidebar();
    },
  });

  const bots = data ?? [];

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose a philosopher"
      >
        <div className="modal-header">
          <h2>{t('modal.choosePhilosopher')}</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          {isLoading && <p>{t('modal.loadingPhilosophers')}</p>}
          <div className="bot-grid">
            {bots.map((bot) => (
              <button
                key={bot._id}
                className="bot-card"
                onClick={() => createMutation.mutate(bot._id)}
                disabled={createMutation.isPending}
              >
                <span className="bot-avatar">{bot.avatar || '🧠'}</span>
                <span className="bot-name">{bot.name}</span>
                {bot.description && (
                  <span className="bot-desc">{bot.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
