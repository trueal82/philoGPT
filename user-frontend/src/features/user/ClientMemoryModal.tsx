import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/shared/api/endpoints';
import { useUIStore } from '@/shared/stores/uiStore';
import type { ClientMemory } from '@/shared/types';

function botName(mem: ClientMemory): string {
  if (typeof mem.botId === 'object' && mem.botId.name) return mem.botId.name;
  return String(mem.botId);
}

function botAvatar(mem: ClientMemory): string {
  if (typeof mem.botId === 'object' && mem.botId.avatar) return mem.botId.avatar;
  return '🧠';
}

function memBotId(mem: ClientMemory): string {
  return typeof mem.botId === 'object' ? mem.botId._id : mem.botId;
}

export default function ClientMemoryModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['allMemories'],
    queryFn: api.getAllMemories,
    select: (d) => d.memories,
  });

  const deleteKeyMut = useMutation({
    mutationFn: ({ bid, key }: { bid: string; key: string }) =>
      api.deleteMemoryKey(bid, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allMemories'] });
    },
  });

  const deleteAllMut = useMutation({
    mutationFn: api.deleteAllMemories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allMemories'] });
    },
  });

  const memories = data ?? [];
  const hasAny = memories.some((m) => Object.keys(m.data ?? {}).length > 0);

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className="modal-content modal-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="My Memory"
      >
        <div className="modal-header">
          <h2>My Memory</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          {hasAny && (
            <div className="memory-actions-top">
              <button
                className="delete-all-btn"
                onClick={() => {
                  if (window.confirm('Delete ALL your memories across all philosophers?')) {
                    deleteAllMut.mutate();
                  }
                }}
                disabled={deleteAllMut.isPending}
              >
                {deleteAllMut.isPending ? 'Deleting…' : 'Delete all my memories'}
              </button>
              <button className="refresh-btn" onClick={() => refetch()}>Refresh</button>
            </div>
          )}

          {isLoading && <p>Loading memories…</p>}
          {!isLoading && !hasAny && <p className="memory-empty">No memories stored yet.</p>}

          {memories
            .filter((m) => Object.keys(m.data ?? {}).length > 0)
            .map((mem) => (
              <div key={mem._id} className="memory-bot-group">
                <h3 className="memory-bot-name">
                  <span className="memory-bot-avatar">{botAvatar(mem)}</span>
                  {botName(mem)}
                </h3>
                <dl className="memory-dl">
                  {Object.entries(mem.data).map(([key, value]) => (
                    <div key={key} className="memory-entry">
                      <div className="memory-entry-content">
                        <dt>{key}</dt>
                        <dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                      </div>
                      <button
                        className="memory-delete-key"
                        aria-label={`Delete ${key}`}
                        onClick={() => deleteKeyMut.mutate({ bid: memBotId(mem), key })}
                        disabled={deleteKeyMut.isPending}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
