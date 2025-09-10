
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showErrorToast, showSuccessToast } from '@/utils/apiErrorHandler';
import { markMessagesAsRead } from '@/utils/messageUtils';
import { MessageCircle, User, Mail, Phone, MapPin } from 'lucide-react';
import { Card } from './ui/card';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

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
  onMessagesRead?: () => void;
}

export const WhatsAppChat: React.FC<WhatsAppChatProps> = ({
  clientId,
  quoteId,
  projectId,
  className = '',
  onMessagesRead
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientInfo, setClientInfo] = useState<any>(null);
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
        showErrorToast('Failed to load messages');
        setMessages([]);
      } else {
        console.log('Messages loaded:', data);
        setMessages(data || []);
      }

      // Load client info if we have clientId
      if (clientId) {
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('id, full_name, email, phone_number, postcode')
          .eq('id', clientId)
          .single();
        
        if (!clientError && client) {
          setClientInfo(client);
        }

        // Mark messages as read when viewing conversation
        const markResult = await markMessagesAsRead(clientId);
        if (markResult && onMessagesRead) {
          onMessagesRead();
        }
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
    
    // Set up real-time subscription for new messages
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: clientId ? `client_id=eq.${clientId}` : quoteId ? `quote_id=eq.${quoteId}` : `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('New message received:', payload);
          setMessages(current => [...current, payload.new as Message]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: clientId ? `client_id=eq.${clientId}` : quoteId ? `quote_id=eq.${quoteId}` : `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('Message updated:', payload);
          setMessages(current => 
            current.map(msg => 
              msg.id === payload.new.id ? { ...msg, ...payload.new } as Message : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, quoteId, projectId]);

  const sendMessage = async (content: string) => {
    try {
      console.log('Sending message with context:', { clientId, quoteId, projectId });

      const { data, error } = await supabase.functions.invoke('send-message', {
        body: {
          content,
          clientId,
          quoteId,
          projectId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send message');
      }

      console.log('Message sent successfully:', data);
      showSuccessToast('Message sent');
      
      // Reload messages to show the new one
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      showErrorToast(error instanceof Error ? error.message : 'Failed to send message');
      throw error;
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

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { [key: string]: Message[] }, message) => {
    const date = new Date(message.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <Card className={`flex flex-col h-[600px] ${className}`}>
      {/* Conversation Header */}
      {clientInfo && (
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/50 p-4 z-10">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {clientInfo.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{clientInfo.full_name}</h3>
                <Badge variant="outline" className="text-xs">
                  <User className="w-3 h-3 mr-1" />
                  Client
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                {clientInfo.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{clientInfo.email}</span>
                  </div>
                )}
                {clientInfo.phone_number && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>{clientInfo.phone_number}</span>
                  </div>
                )}
                {clientInfo.postcode && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{clientInfo.postcode}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">No messages yet</p>
            <p className="text-sm text-muted-foreground/80">
              Start a conversation by sending a message below
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {Object.entries(groupedMessages).map(([date, dayMessages]) => (
              <div key={date}>
                {/* Date Separator */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px bg-border flex-1" />
                  <span className="text-xs text-muted-foreground font-medium px-2 py-1 bg-muted rounded-full">
                    {new Date(date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                  <div className="h-px bg-border flex-1" />
                </div>
                
                {/* Messages for this date */}
                <div className="space-y-2">
                  {dayMessages.map((message, index) => {
                    const prevMessage = index > 0 ? dayMessages[index - 1] : null;
                    const isGrouped = prevMessage && 
                      prevMessage.sender_id === message.sender_id &&
                      new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 300000; // 5 minutes
                    
                    return (
                      <ChatBubble
                        key={message.id}
                        message={message}
                        isOwn={message.sender_id === user?.id}
                        isGrouped={isGrouped}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <ChatInput
        onSendMessage={sendMessage}
        placeholder="Type your message..."
      />
    </Card>
  );
};
