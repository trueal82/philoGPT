interface Props {
  content: string;
  done: boolean;
}

/** Strip all known Gemma 4 control tokens that may leak through. Mirrors backend GEMMA4_CONTROL_TOKEN_RE. */
const GEMMA4_CONTROL_TOKEN_RE = /thought<\|channel>|<\|channel>thought|<\|channel>|<channel\|>|<\|start_of_thinking\|>|<\|end_of_thinking\|>|<\|think\|>|<\|turn>|<turn\|>|<\|tool_call>|<tool_call\|>|<\|tool_response>|<tool_response\|>|<\|tool>|<tool\|>|<\|"\|>|<\|image\|>|<\|image>|<image\|>|<\|audio\|>|<\|audio>|<audio\|>/g;
function stripGemmaControlTokens(text: string): string {
  return text.replace(GEMMA4_CONTROL_TOKEN_RE, '').trim();
}

export default function ThinkingBox({ content, done }: Props) {
  const cleaned = stripGemmaControlTokens(content);
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
