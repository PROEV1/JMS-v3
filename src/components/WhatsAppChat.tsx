
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Send, MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import ChatBubble from './ChatBubble';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_role: 'admin' | 'client' | 'engineer' | 'manager' | 'standard_office_user';
  created_at: string;
  status?: 'sending' | 'sent' | 'delivered' | 'failed';
  is_read: boolean;
  client_id?: string;
  quote_id?: string;
  project_id?: string;
}

interface WhatsAppChatProps {
  clientId?: string;
  quoteId?: string;
  projectId?: string;
  className?: string;
}

export const WhatsAppChat: React.FC<WhatsAppChatProps> = ({
  clientId,
  quoteId,
  projectId,
  className = ''
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      console.log('Loading messages with:', { clientId, quoteId, projectId });

      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      // Apply filters based on available context
      if (clientId) {
        query = query.eq('client_id', clientId);
      } else if (quoteId) {
        query = query.eq('quote_id', quoteId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      } else {
        // No context provided - this shouldn't happen but handle gracefully
        console.warn('WhatsAppChat: No clientId, quoteId, or projectId provided');
        setMessages([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading messages:', error);
        toast.error('Failed to load messages');
        setMessages([]);
      } else {
        console.log('Messages loaded:', data);
        setMessages(data || []);
      }
    } catch (err) {
      console.error('Error in loadMessages:', err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [clientId, quoteId, projectId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      console.log('Sending message with context:', { clientId, quoteId, projectId });

      const { data, error } = await supabase.functions.invoke('send-message', {
        body: {
          content: newMessage.trim(),
          clientId,
          quoteId,
          projectId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send message');
      }

      console.log('Message sent successfully:', data);
      setNewMessage('');
      toast.success('Message sent');
      
      // Reload messages to show the new one
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2 text-sm text-muted-foreground">Loading messages...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`flex flex-col h-[500px] ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Messages</h3>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">No messages yet</p>
            <p className="text-sm text-muted-foreground/80">
              Start a conversation by sending a message below
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              isOwn={message.sender_id === user?.id}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 min-h-[40px] max-h-[120px] resize-none"
            disabled={sending}
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            size="sm"
            className="px-3"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
