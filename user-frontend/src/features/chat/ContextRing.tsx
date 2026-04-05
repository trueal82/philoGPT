export interface ContextUsage {
  usedTokens: number;
  contextWindow: number;
  system: number;
  history: number;
  tools: number;
}

interface Props {
  usage: ContextUsage | null;
  onClick: () => void;
}

export default function ContextRing({ usage, onClick }: Props) {
  const ratio = usage ? Math.min(1, usage.usedTokens / usage.contextWindow) : 0;
  const pct = Math.round(ratio * 100);
  const r = 9;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - ratio);
  const stroke = ratio < 0.6 ? 'var(--color-accent)' : ratio < 0.8 ? '#f0b429' : '#e53e3e';

  return (
    <button
      type="button"
      className="context-ring-btn"
      onClick={onClick}
      title={usage ? `Context: ${pct}% (${usage.usedTokens.toLocaleString()} / ${usage.contextWindow.toLocaleString()} tokens)` : 'Context: no data yet'}
      aria-label={`Context window ${pct}% full`}
    >
      <svg width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r={r} fill="none" stroke="var(--color-border)" strokeWidth="2.5" />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 12 12)"
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
      </svg>
    </button>
  );
}
