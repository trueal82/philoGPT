import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '@/shared/types';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  // Hide tool and system messages from visible chat
  if (message.role === 'tool' || message.role === 'system') return null;
  // Hide internal tool_call placeholder messages
  if (message.role === 'assistant' && message.content === '[tool_call]') return null;

  const isUser = message.role === 'user';

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className="message-content">
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
