interface Props {
  content: string;
  done: boolean;
}

export default function ThinkingBox({ content, done }: Props) {
  return (
    <details className="thinking-box" open={!done}>
      <summary className="thinking-box-summary">
        {done ? 'Thought process' : 'Thinking\u2026'}
      </summary>
      <div className="thinking-box-content">
        {content}
      </div>
    </details>
  );
}
