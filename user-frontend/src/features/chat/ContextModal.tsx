import type { ContextUsage } from './ContextRing';

interface Props {
  usage: ContextUsage | null;
  onClose: () => void;
  onCompress: () => void;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function ContextModal({ usage, onClose, onCompress }: Props) {
  const ratio = usage ? Math.min(1, usage.usedTokens / usage.contextWindow) : 0;
  const pct = Math.round(ratio * 100);
  const fillColor = ratio < 0.6 ? 'var(--color-accent)' : ratio < 0.8 ? '#f0b429' : '#e53e3e';

  const breakdown = usage ? [
    { label: 'System prompt', tokens: usage.system },
    { label: 'Conversation', tokens: usage.history },
    { label: 'Tool definitions', tokens: usage.tools },
  ] : [];
  const maxTokens = Math.max(1, ...breakdown.map((b) => b.tokens));

  return (
    <>
      <div className="info-modal-backdrop" onClick={onClose} />
      <div className="info-modal context-usage-modal">
        <button className="info-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h4 className="info-modal-title">Context Window</h4>

        {/* Overview bar */}
        {usage ? (
          <div className="ctx-overview">
            <div className="ctx-overview-label">
              <span style={{ color: fillColor }}>{pct}% used</span>
              <span className="ctx-overview-count">
                {fmtTokens(usage.usedTokens)} / {fmtTokens(usage.contextWindow)} tokens
              </span>
            </div>
            <div className="ctx-overview-track">
              <div
                className="ctx-overview-fill"
                style={{ width: `${pct}%`, background: fillColor }}
              />
            </div>
          </div>
        ) : (
          <p className="ctx-no-data">No data</p>
        )}

        {/* Breakdown rows */}
        <div className="ctx-breakdown">
          {breakdown.map((row) => {
            const barPct = Math.max(2, Math.round((row.tokens / maxTokens) * 100));
            return (
              <div key={row.label} className="ctx-breakdown-row">
                <span className="ctx-breakdown-label">{row.label}</span>
                <div className="ctx-breakdown-bar-track">
                  <div className="ctx-breakdown-bar" style={{ width: `${barPct}%` }} />
                </div>
                <span className="ctx-breakdown-count">{fmtTokens(row.tokens)}</span>
              </div>
            );
          })}
        </div>

        {/* Compress button */}
        <button
          className="btn btn-secondary ctx-compress-btn"
          onClick={() => { onClose(); onCompress(); }}
        >
          Compress history
        </button>
      </div>
    </>
  );
}
