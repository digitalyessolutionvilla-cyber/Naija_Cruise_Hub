import { useState, useRef } from 'react';
import { Send, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const QUICK_EMOJIS = ['😂', '❤️', '🔥', '👏', '😍', '🙌', '💯', '🤣'];

export function ChatInput({ onSend, placeholder = 'Type a message...', disabled, className }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    setShowEmojis(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addEmoji = (emoji: string) => {
    setValue(prev => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className={cn('space-y-2', className)}>
      {showEmojis && (
        <div className="flex gap-2 px-1 animate-fade-in">
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              className="text-xl hover:scale-125 transition-transform"
              onClick={() => addEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 glass rounded-2xl p-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-primary"
          onClick={() => setShowEmojis(prev => !prev)}
        >
          <Smile className="w-5 h-5" />
        </Button>
        <Input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="border-0 bg-transparent focus-visible:ring-0 text-sm px-0 h-8"
        />
        <Button
          size="icon"
          className={cn(
            'h-8 w-8 flex-shrink-0 rounded-full transition-all',
            value.trim() ? 'gradient-primary text-white shadow-glow-purple' : 'bg-muted text-muted-foreground'
          )}
          onClick={handleSend}
          disabled={!value.trim() || disabled}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
