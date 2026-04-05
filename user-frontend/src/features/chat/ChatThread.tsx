import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Message as MessageType } from '@/shared/types';
import * as api from '@/shared/api/endpoints';
import { connectSocket, getSocket } from '@/shared/api/socket';
import { showToast } from '@/shared/stores/toastStore';
import MessageBubble from './MessageBubble';
import ThinkingBox from './ThinkingBox';
import ChatInput from './ChatInput';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUIStore } from '@/shared/stores/uiStore';

interface Props {
  sessionId: string;
}

export default function ChatThread({ sessionId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const openModal = useUIStore((s) => s.openModal);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingMessageRef = useRef<{ sessionId: string; content: string } | null>(null);
  const isRetryingRef = useRef(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [thinkingContent, setThinkingContent] = useState('');
  const [thinkingDone, setThinkingDone] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isToolRunning, setIsToolRunning] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['messages', sessionId],
    queryFn: () => api.getMessages(sessionId),
    select: (d) => d.messages,
    retry: false,
  });

  const messages = data ?? [];

  // If the session is gone (404 / network error), show error modal
  const [showErrorModal, setShowErrorModal] = useState(false);
  useEffect(() => {
    if (isError) setShowErrorModal(true);
  }, [isError]);

  // Auto-scroll to bottom on new messages, streaming tokens, or waiting state.
  // Use 'instant' during streaming so rapid token updates don't queue competing
  // smooth scrolls that never reach the bottom.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, streamingContent, thinkingContent, isWaiting]);

  // Socket event handlers
  useEffect(() => {
    const socket = getSocket();

    const retryPendingMessage = () => {
      const pending = pendingMessageRef.current;
      if (!pending || pending.sessionId !== sessionId || isRetryingRef.current) return;
      if (!socket.connected) return;

      isRetryingRef.current = true;
      socket.emit('chat:send', { sessionId: pending.sessionId, content: pending.content });
      showToast({ kind: 'success', message: t('toast.chatResent') }, 3000);
    };

    const onToken = (payload: { sessionId: string; token: string }) => {
      if (payload.sessionId !== sessionId) return;
      // Frontend safety net: strip any Gemma 4 control tokens that leaked through
      // the backend filter (e.g. split-chunk edge cases). Mirrors GEMMA4_CONTROL_TOKEN_RE.
      const GEMMA4_RE = /thought<\|channel>|<\|channel>thought|<\|channel>|<channel\|>|<\|start_of_thinking\|>|<\|end_of_thinking\|>|<\|think\|>|<\|turn>|<turn\|>|<\|tool_call>|<tool_call\|>|<\|tool_response>|<tool_response\|>|<\|tool>|<tool\|>|<\|"\|>|<\|image\|>|<\|image>|<image\|>|<\|audio\|>|<\|audio>|<audio\|>/g;
      const token = payload.token.replace(GEMMA4_RE, '');
      if (!token) return;
      setIsToolRunning(false);
      setIsWaiting(false);
      setIsStreaming(true);
      setStreamingContent((prev) => prev + token);
    };

    const onToolStart = (payload: { sessionId: string }) => {
      if (payload.sessionId !== sessionId) return;
      // Clear any [tool_call] artefacts that may have streamed and show the tool indicator
      setStreamingContent('');
      setIsStreaming(false);
      setIsWaiting(false);
      setIsToolRunning(true);
    };

    const onThinking = (payload: { sessionId: string; token: string }) => {
      if (payload.sessionId !== sessionId) return;
      setIsWaiting(false);
      setThinkingDone(false);
      setThinkingContent((prev) => prev + payload.token);
    };

    const onDone = (payload: { sessionId: string; metadata?: Record<string, unknown> }) => {
      if (payload.sessionId !== sessionId) return;
      pendingMessageRef.current = null;
      isRetryingRef.current = false;
      setStreamingContent('');
      setIsStreaming(false);
      setIsWaiting(false);
      setIsToolRunning(false);
      setThinkingContent('');
      setThinkingDone(true);
      // metadata is persisted on the Message doc; MessageBubble reads it from there
      queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    };

    const onError = (payload: { sessionId: string; error: string }) => {
      if (payload.sessionId !== sessionId) return;
      isRetryingRef.current = false;
      setStreamingContent('');
      setIsStreaming(false);
      setIsWaiting(false);
      setIsToolRunning(false);
      console.error('Chat error:', payload.error);
      showToast({ kind: 'error', message: payload.error || t('toast.chatFailed') }, 5000);
    };

    const onConnect = () => {
      retryPendingMessage();
    };

    const onDisconnect = () => {
      if (pendingMessageRef.current?.sessionId === sessionId) {
        showToast({ kind: 'info', message: t('toast.connectionLostRetrying') }, 5000);
      }
    };

    const onConnectError = () => {
      if (pendingMessageRef.current?.sessionId === sessionId) {
        showToast({ kind: 'info', message: t('toast.connectionRetrying') }, 5000);
      }
    };

    socket.on('chat:token', onToken);
    socket.on('chat:thinking', onThinking);
    socket.on('chat:tool_start', onToolStart);
    socket.on('chat:done', onDone);
    socket.on('chat:error', onError);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('chat:token', onToken);
      socket.off('chat:thinking', onThinking);
      socket.off('chat:tool_start', onToolStart);
      socket.off('chat:done', onDone);
      socket.off('chat:error', onError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [sessionId, queryClient, t]);

  const handleSend = useCallback(
    (content: string) => {
      const socket = getSocket();
      pendingMessageRef.current = { sessionId, content };
      setIsWaiting(true);
      setThinkingContent('');
      setThinkingDone(false);


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

      if (socket.connected) {
        socket.emit('chat:send', { sessionId, content });
      } else {
        connectSocket();
        showToast({ kind: 'info', message: t('toast.chatQueuedReconnect') }, 5000);
      }
    },
    [sessionId, queryClient, t],
  );

  if (showErrorModal) {
    return (
      <div className="chat-thread">
        <div className="modal-overlay" style={{ position: 'absolute', zIndex: 10 }}>
          <div className="modal-content modal-sm" role="alertdialog" aria-label={t('error.title')} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('error.title')}</h2>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: '1rem' }}>{t('error.sessionNotFound')}</p>
              <button className="btn btn-primary" onClick={() => { setShowErrorModal(false); navigate('/chat', { replace: true }); }}>
                {t('error.backToStart')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="chat-thread"><p className="chat-loading">{t('chat.loadingMessages')}</p></div>;
  }

  return (
    <div className="chat-thread">
      <div className="messages-container" ref={containerRef}>
        {messages.length === 0 && !isStreaming && (
          <p className="chat-empty">{t('chat.emptyState')}</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m._id} message={m} />
        ))}
        {thinkingContent && (
          <div className="message message-assistant">
            <ThinkingBox content={thinkingContent} done={thinkingDone} />
          </div>
        )}
        {isStreaming && streamingContent && (
          <div className="message message-assistant">
            <div className="message-content streaming">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamingContent}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {isToolRunning && !isStreaming && (
          <div className="message message-assistant">
            <div className="message-content thinking-indicator tool-running">
              <span className="tool-running-label">{t('chat.consultingLibrary')}</span>
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}
        {isWaiting && !isStreaming && !isToolRunning && (
          <div className="message message-assistant">
            <div className="message-content thinking-indicator">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={handleSend} disabled={isStreaming || isWaiting} onOpenPlan={() => openModal('counselingPlan')} />
    </div>
  );
}
