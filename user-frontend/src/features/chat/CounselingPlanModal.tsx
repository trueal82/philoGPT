import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/shared/stores/uiStore';
import * as api from '@/shared/api/endpoints';
import { getSocket } from '@/shared/api/socket';
import type { CounselingPlan, CounselingStep } from '@/shared/types';

interface Props {
  sessionId: string;
}

export default function CounselingPlanModal({ sessionId }: Props) {
  const { t } = useTranslation();
  const closeModal = useUIStore((s) => s.closeModal);
  const [plan, setPlan] = useState<CounselingPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await api.getCounselingPlan(sessionId);
      setPlan(res.counselingPlan);
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Listen for real-time plan updates
  useEffect(() => {
    const socket = getSocket();
    const onPlanUpdated = (payload: { sessionId: string }) => {
      if (payload.sessionId === sessionId) {
        fetchPlan();
      }
    };
    socket.on('plan:updated', onPlanUpdated);
    return () => { socket.off('plan:updated', onPlanUpdated); };
  }, [sessionId, fetchPlan]);

  const handleToggleStatus = async (step: CounselingStep) => {
    const nextStatus = step.status === 'completed' ? 'pending' : 'completed';
    try {
      const res = await api.updateCounselingPlanStep(sessionId, step.stepId, nextStatus);
      setPlan(res.counselingPlan);
    } catch {
      // silent
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '●';
      case 'in_progress': return '◐';
      default: return '○';
    }
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content counseling-plan-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('counselingPlan.title')}</h2>

        {loading && <p className="plan-loading">{t('common.loading')}</p>}

        {!loading && !plan && (
          <p className="plan-empty">{t('counselingPlan.empty')}</p>
        )}

        {!loading && plan && (
          <>
            <h3 className="plan-name">{plan.title}</h3>
            <ul className="plan-steps">
              {plan.steps.map((step) => (
                <li
                  key={step.stepId}
                  className={`plan-step plan-step--${step.status}`}
                >
                  <button
                    className="plan-step-toggle"
                    onClick={() => handleToggleStatus(step)}
                    title={t('counselingPlan.toggleStatus')}
                    aria-label={`${step.title}: ${t(`counselingPlan.status.${step.status}`)}`}
                  >
                    <span className="plan-step-icon">{statusIcon(step.status)}</span>
                  </button>
                  <div className="plan-step-content">
                    <span className="plan-step-title">{step.title}</span>
                    {step.description && (
                      <span className="plan-step-desc">{step.description}</span>
                    )}
                    <span className={`plan-step-badge plan-step-badge--${step.status}`}>
                      {t(`counselingPlan.status.${step.status}`)}
                    </span>
                    {step.evidence && (
                      <span className="plan-step-evidence">{step.evidence}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <button className="modal-close-btn" onClick={closeModal}>
          {t('counselingPlan.close')}
        </button>
      </div>
    </div>
  );
}
