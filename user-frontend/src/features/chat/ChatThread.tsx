import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Message as MessageType } from '@/shared/types';
import * as api from '@/shared/api/endpoints';
import { getSocket } from '@/shared/api/socket';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  sessionId: string;
}

export default function ChatThread({ sessionId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['messages', sessionId],
    queryFn: () => api.getMessages(sessionId),
    select: (d) => d.messages,
  });

  const messages = data ?? [];

  // Auto-scroll on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingContent, isWaiting]);

  // Socket event handlers
  useEffect(() => {
    const socket = getSocket();

    const onToken = (payload: { sessionId: string; token: string }) => {
      if (payload.sessionId !== sessionId) return;
      setIsWaiting(false);
      setIsStreaming(true);
      setStreamingContent((prev) => prev + payload.token);
    };

    const onDone = (payload: { sessionId: string }) => {
      if (payload.sessionId !== sessionId) return;
      setStreamingContent('');
      setIsStreaming(false);
      setIsWaiting(false);
      queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    };

    const onError = (payload: { sessionId: string; error: string }) => {
      if (payload.sessionId !== sessionId) return;
      setStreamingContent('');
      setIsStreaming(false);
      setIsWaiting(false);
      console.error('Chat error:', payload.error);
    };

    socket.on('chat:token', onToken);
    socket.on('chat:done', onDone);
    socket.on('chat:error', onError);

    return () => {
      socket.off('chat:token', onToken);
      socket.off('chat:done', onDone);
      socket.off('chat:error', onError);
    };
  }, [sessionId, queryClient]);

  const handleSend = useCallback(
    (content: string) => {
      const socket = getSocket();
      socket.emit('chat:send', { sessionId, content });
      setIsWaiting(true);

      // Optimistic user message
      const optimistic: MessageType = {
        _id: `opt-${Date.now()}`,
        sessionId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<{ messages: MessageType[] }>(
        ['messages', sessionId],
        (old) => ({
          messages: [...(old?.messages ?? []), optimistic],
        }),
      );
    },
    [sessionId, queryClient],
  );

  if (isLoading) {
    return <div className="chat-thread"><p className="chat-loading">{t('chat.loadingMessages')}</p></div>;
  }

  return (
    <div className="chat-thread">
      <div className="messages-container">
        {messages.length === 0 && !isStreaming && (
          <p className="chat-empty">{t('chat.emptyState')}</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m._id} message={m} />
        ))}
        {isStreaming && streamingContent && (
          <div className="message message-assistant">
            <div className="message-content streaming">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamingContent}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {isWaiting && !isStreaming && (
          <div className="message message-assistant">
            <div className="message-content thinking-indicator">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={handleSend} disabled={isStreaming || isWaiting} />
    </div>
  );
}
