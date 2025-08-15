
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Paperclip, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChatInput({ 
  onSendMessage, 
  placeholder = "Type a message...", 
  disabled = false 
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await onSendMessage(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="sticky bottom-0 bg-gradient-to-b from-background/80 to-background backdrop-blur-sm border-t border-border/30 p-3">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled || sending}
            className={cn(
              "min-h-[40px] max-h-32 resize-none pr-4 rounded-2xl border-border/60 focus:border-primary bg-card shadow-sm",
              "transition-all duration-200",
              "focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0",
              message ? "border-primary/40" : ""
            )}
            rows={1}
          />
        </div>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sending || disabled}
          size="sm"
          className={cn(
            "rounded-full w-10 h-10 p-0 flex-shrink-0 shadow-md",
            "transition-all duration-200",
            "hover:shadow-lg hover:scale-105",
            message.trim() ? "bg-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
