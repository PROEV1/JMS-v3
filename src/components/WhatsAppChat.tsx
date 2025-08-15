
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MessageSquare, Users, Paperclip, Image as ImageIcon, Send as SendIcon, Smile } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

interface Message {
  id: string;
  content: string;
  sender_role: 'admin' | 'client' | 'engineer' | 'manager' | 'standard_office_user';
  created_at: string;
  is_read: boolean;
  sender_id: string;
  quote_id?: string;
  project_id?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'failed';
}

interface WhatsAppChatProps {
  clientId?: string;
  quoteId?: string;
  projectId?: string;
  title?: string;
}

export default function WhatsAppChat({ 
  clientId, 
  quoteId, 
  projectId, 
  title = "Messages" 
}: WhatsAppChatProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'client' | 'engineer' | 'manager' | 'standard_office_user'>('client');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      // Get user role
      supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setUserRole(data.role);
        });
    }
    
    loadMessages();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        const newMessage = payload.new as Message;
        if (shouldShowMessage(newMessage)) {
          // Check if this message is already in our list (from optimistic update)
          setMessages(prev => {
            const existingIndex = prev.findIndex(msg => 
              msg.content === newMessage.content && 
              msg.sender_id === newMessage.sender_id &&
              msg.id.startsWith('temp-')
            );
            
            if (existingIndex >= 0) {
              // Replace the temporary message with the real one
              const updated = [...prev];
              updated[existingIndex] = { ...newMessage, status: 'delivered' };
              return updated;
            } else {
              // New message from someone else
              return [...prev, { ...newMessage, status: 'delivered' }];
            }
          });
          scrollToBottom();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        const updatedMessage = payload.new as Message;
        if (shouldShowMessage(updatedMessage)) {
          setMessages(prev => prev.map(msg => 
            msg.id === updatedMessage.id ? updatedMessage : msg
          ));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, quoteId, projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const shouldShowMessage = (message: Message) => {
    if (quoteId && message.quote_id === quoteId) return true;
    if (projectId && message.project_id === projectId) return true;
    if (clientId) {
      // For client-specific view, show messages that are either:
      // 1. Associated with their quotes/projects, OR
      // 2. General messages in their conversation (no specific quote/project)
      return !message.quote_id && !message.project_id;
    }
    return true;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      console.log('WhatsAppChat: Loading messages for:', { clientId, quoteId, projectId });
      
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (clientId) {
        // Get client's user_id
        const { data: clientData } = await supabase
          .from('clients')
          .select('user_id')
          .eq('id', clientId)
          .single();

        console.log('WhatsAppChat: Client data:', clientData);

        if (clientData?.user_id) {
          // For client-specific messages, filter by sender_id matching the client's user_id
          query = query.eq('sender_id', clientData.user_id);
        } else {
          // If no valid client data, return empty results
          setMessages([]);
          setLoading(false);
          return;
        }
      } else if (quoteId) {
        query = query.eq('quote_id', quoteId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('WhatsAppChat: Raw loaded messages:', data);
      console.log('WhatsAppChat: Messages after shouldShowMessage filter:', data?.filter(msg => shouldShowMessage(msg)));
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!session?.user?.id || !content.trim()) return;

    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      content,
      sender_role: userRole || 'client',
      created_at: new Date().toISOString(),
      is_read: false,
      sender_id: session.user.id,
      quote_id: quoteId,
      project_id: projectId,
      status: 'sending',
    };

    // Optimistically add message to UI
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    try {
      const response = await fetch(`https://jttogvpjfeegbkpturey.supabase.co/functions/v1/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          content,
          clientId,
          quoteId,
          projectId,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      // Update the temporary message with the real message data
      setMessages(prev => prev.map(msg => 
        msg.id === tempId 
          ? { ...result.message, status: 'sent' }
          : msg
      ));

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update message status to failed
      setMessages(prev => prev.map(msg => 
        msg.id === tempId 
          ? { ...msg, status: 'failed' }
          : msg
      ));

      toast({
        title: "Failed to send message",
        description: "Tap to retry",
        variant: "destructive",
      });
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Mark unread messages as read when component mounts or messages change
  useEffect(() => {
    const unreadMessages = messages.filter(msg => 
      !msg.is_read && 
      msg.sender_role !== userRole
    );
    
    unreadMessages.forEach(msg => markAsRead(msg.id));
  }, [messages, userRole]);

  const unreadCount = messages.filter(msg => !msg.is_read && msg.sender_role !== userRole).length;

  if (loading) {
    return (
      <Card className="h-[calc(100vh-16rem)] md:h-[600px] shadow-lg border-muted/40 overflow-hidden rounded-xl">
        <CardContent className="p-0 flex items-center justify-center h-full bg-gradient-to-br from-background to-muted/30">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center animate-pulse">
                <MessageSquare className="h-6 w-6 text-muted-foreground opacity-70" />
              </div>
              <div className="absolute -right-1 -bottom-1 w-4 h-4 bg-primary rounded-full animate-ping" />
            </div>
            <div className="text-muted-foreground animate-pulse">Loading conversations...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[calc(100vh-16rem)] md:h-[600px] shadow-lg border-muted/40 overflow-hidden rounded-xl flex flex-col bg-gradient-to-br from-background to-muted/10">
      <CardHeader className="bg-card shadow-sm border-b border-border/50 p-4 flex-shrink-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="bg-primary/10 rounded-full p-2">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-destructive-foreground font-semibold">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-none tracking-tight">{title}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <Users className="h-3 w-3" />
                <span>{messages.length} messages</span>
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <AnimatePresence initial={false}>
            {messages.length > 0 ? (
              <div className="space-y-3">
                {messages.map((message, index) => {
                  const isOwn = userRole === 'admin' ? message.sender_role === 'admin' : message.sender_role === 'client';
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const showAvatar = !prevMessage || prevMessage.sender_role !== message.sender_role;
                  
                  return (
                    <motion.div 
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChatBubble
                        message={message}
                        isOwn={!!isOwn}
                        showAvatar={showAvatar}
                        senderName={message.sender_role === 'admin' ? 'ProSpaces Team' : 'Client'}
                      />
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full min-h-[320px] text-center p-8"
              >
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-medium mb-2 text-foreground">No messages yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Start a conversation by sending a message below!
                </p>
              </motion.div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </AnimatePresence>
        </ScrollArea>
        
        <div className="mt-auto">
          <ChatInput
            onSendMessage={sendMessage}
            placeholder="Type your message..."
            disabled={!session}
          />
        </div>
      </CardContent>
    </Card>
  );
}
