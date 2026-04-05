interface Props {
  metadata: Record<string, unknown>;
  onClose: () => void;
}

interface TimingEntry {
  type: 'llm' | 'tool';
  name?: string;
  round?: number;
  durationMs: number;
}

function fmtDur(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function CallTimeline({ timings, totalMs }: { timings: TimingEntry[]; totalMs: number }) {
  const llmCount = timings.filter((t) => t.type === 'llm').length;
  return (
    <div className="call-timeline">
      {timings.map((entry, i) => {
        const barPct = Math.max(2, Math.round((entry.durationMs / totalMs) * 100));
        const pct = Math.round((entry.durationMs / totalMs) * 100);
        const isLlm = entry.type === 'llm';
        const label = isLlm
          ? (llmCount > 1 ? `LLM (round ${(entry.round ?? 0) + 1})` : 'LLM inference')
          : (entry.name ?? 'tool');
        return (
          <div key={i} className="call-timeline-row">
            <div className="call-timeline-header">
              <span className={`call-timeline-dot ${isLlm ? 'dot-llm' : 'dot-tool'}`} />
              <span className="call-timeline-label">{label}</span>
              <span className="call-timeline-dur">
                {fmtDur(entry.durationMs)}<span className="call-timeline-pct"> {pct}%</span>
              </span>
            </div>
            <div className="call-timeline-track">
              <div
                className={`call-timeline-bar ${isLlm ? 'bar-llm' : 'bar-tool'}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function InfoModal({ metadata, onClose }: Props) {
  const model = metadata.model as string | undefined;
  const durationMs = metadata.durationMs as number | undefined;
  const toolCalls = metadata.toolCalls as string[] | undefined;
  const thinking = metadata.thinking as string | undefined;
  const tokensPerSecond = metadata.tokensPerSecond as number | undefined;
  const evalTokens = metadata.evalTokens as number | undefined;
  const promptTokens = metadata.promptTokens as number | undefined;
  const timings = metadata.timings as TimingEntry[] | undefined;
  const hasTimeline = timings && timings.length > 1 && durationMs !== undefined;

  return (
    <>
      <div className="info-modal-backdrop" onClick={onClose} />
      <div className="info-modal" style={hasTimeline ? { maxWidth: '420px' } : undefined}>
        <button className="info-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h4 className="info-modal-title">Response Info</h4>
        <dl className="info-modal-list">
          {model && (
            <>
              <dt>Model</dt>
              <dd>{model}</dd>
            </>
          )}
          {durationMs !== undefined && (
            <>
              <dt>Response time</dt>
              <dd>{durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}</dd>
            </>
          )}
          {tokensPerSecond !== undefined && (
            <>
              <dt>Speed</dt>
              <dd>{tokensPerSecond} tokens/s</dd>
            </>
          )}
          {(evalTokens !== undefined || promptTokens !== undefined) && (
            <>
              <dt>Tokens</dt>
              <dd>
                {promptTokens !== undefined && <span>{promptTokens} prompt</span>}
                {promptTokens !== undefined && evalTokens !== undefined && ' · '}
                {evalTokens !== undefined && <span>{evalTokens} response</span>}
              </dd>
            </>
          )}
          {toolCalls && toolCalls.length > 0 && (
            <>
              <dt>Tools used</dt>
              <dd>{toolCalls.join(', ')}</dd>
            </>
          )}
          {thinking && (
            <>
              <dt>Thinking</dt>
              <dd>{thinking.length} chars</dd>
            </>
          )}
        </dl>
        {hasTimeline && (
          <div className="info-modal-timeline-section">
            <div className="info-modal-timeline-title">Call timeline</div>
            <CallTimeline timings={timings!} totalMs={durationMs!} />
          </div>
        )}
      </div>
    </>
  );
}
