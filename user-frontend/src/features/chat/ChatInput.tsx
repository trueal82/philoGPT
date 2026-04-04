import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
  onOpenPlan?: () => void;
}

export default function ChatInput({ onSend, disabled, onOpenPlan }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Re-focus when the input becomes enabled (i.e. response finished)
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  };

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      {onOpenPlan && (
        <button
          type="button"
          className="plan-btn"
          onClick={onOpenPlan}
          title={t('counselingPlan.openTooltip')}
          aria-label={t('counselingPlan.openTooltip')}
        >
          ☰
        </button>
      )}
      <textarea
        ref={textareaRef}
        className="chat-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={t('chat.inputPlaceholder')}
        rows={1}
        aria-label="Message input"
      />
      <button
        type="submit"
        className="send-btn"
        disabled={disabled || !text.trim()}
        aria-label="Send message"
      >
        ↑
      </button>
    </form>
  );
}
