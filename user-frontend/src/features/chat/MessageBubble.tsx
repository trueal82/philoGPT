import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { Message } from '@/shared/types';
import ThinkingBox from './ThinkingBox';
import InfoModal from './InfoModal';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const [showInfo, setShowInfo] = useState(false);

  // Hide tool and system messages from visible chat
  if (message.role === 'tool' || message.role === 'system') return null;
  // Hide internal tool_call placeholder messages
  if (message.role === 'assistant' && message.content === '[tool_call]') return null;

  const isUser = message.role === 'user';
  const meta = message.metadata as Record<string, unknown> | undefined;
  const hasInfo = !isUser && !!meta?.model;
  const thinking = meta?.thinking as string | undefined;

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'}`}>
      {thinking && (
        <ThinkingBox content={thinking} done />
      )}
      <div className="message-content">
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
            {message.content}
          </ReactMarkdown>
        )}
        {hasInfo && (
          <button
            className="msg-info-btn"
            onClick={() => setShowInfo(true)}
            aria-label="Response info"
            title="Response info"
          >
            &#9432;
          </button>
        )}
      </div>
      {showInfo && meta && (
        <InfoModal metadata={meta} onClose={() => setShowInfo(false)} />
      )}
    </div>
  );
}
