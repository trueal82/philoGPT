interface Props {
  content: string;
  done: boolean;
}

/** Strip Gemma 4 channel control tags that may leak through. */
const CHANNEL_TAG_RE = /thought<\|channel>|<\|channel>thought|<channel\|>|<\|channel>|<\|start_of_thinking\|>|<\|end_of_thinking\|>/g;
function stripChannelTags(text: string): string {
  return text.replace(CHANNEL_TAG_RE, '').trim();
}

export default function ThinkingBox({ content, done }: Props) {
  const cleaned = stripChannelTags(content);
  if (!cleaned) return null;

  return (
    <details className="thinking-box" open={!done}>
      <summary className="thinking-box-summary">
        {done ? 'Thought process' : 'Thinking\u2026'}
      </summary>
      <div className="thinking-box-content">
        {cleaned}
      </div>
    </details>
  );
}
