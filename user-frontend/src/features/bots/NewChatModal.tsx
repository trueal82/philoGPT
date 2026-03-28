import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as api from '@/shared/api/endpoints';
import { useUIStore } from '@/shared/stores/uiStore';

export default function NewChatModal() {
  const closeModal = useUIStore((s) => s.closeModal);
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
          <h2>Choose a Philosopher</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          {isLoading && <p>Loading philosophers…</p>}
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
