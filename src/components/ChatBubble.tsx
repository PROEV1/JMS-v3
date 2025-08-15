
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

interface ChatBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  senderName?: string;
}

export default function ChatBubble({ message, isOwn, showAvatar = true, senderName }: ChatBubbleProps) {
  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const getInitials = (name?: string) => {
    if (!name) {
      if (message.sender_role === 'admin') return 'PS';
      if (message.sender_role === 'engineer') return 'EN';
      return 'CL';
    }
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className={`flex gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'} group`}>
      {showAvatar && (
        <div className={`pt-1 ${isOwn ? 'pl-2' : 'pr-2'}`}>
          <Avatar className="w-8 h-8 border-2 border-background shadow-sm transition-transform duration-200 group-hover:scale-105">
            <AvatarFallback className={`text-xs ${
              message.sender_role === 'admin' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary text-secondary-foreground'
            }`}>
              {getInitials(senderName)}
            </AvatarFallback>
            {/* If you have user images, enable this */}
            {/* <AvatarImage src="/path-to-image.jpg" alt={senderName || 'User'} /> */}
          </Avatar>
        </div>
      )}
      
      <div className={`flex flex-col max-w-[85%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {(!isOwn && senderName && showAvatar) && (
          <div className="flex items-center gap-2 mb-1 pl-1">
            <span className="text-xs font-medium text-muted-foreground">{senderName}</span>
            <Badge variant={message.sender_role === 'admin' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
              {message.sender_role === 'admin' ? 'ProSpaces Team' : message.sender_role === 'engineer' ? 'Engineer' : 'Client'}
            </Badge>
          </div>
        )}
        
        <div className={`relative px-4 py-3 shadow-sm transition-all duration-200 group-hover:shadow-md ${
          isOwn 
            ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-2xl rounded-tr-sm' 
            : 'bg-card border border-border/40 rounded-2xl rounded-tl-sm'
        }`}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          
          <div className={`flex items-center gap-1 mt-1 ${
            isOwn ? 'justify-end' : 'justify-start'
          }`}>
            <span className={`text-xs ${
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            }`}>
              {formatTime(message.created_at)}
            </span>
            
            {isOwn && (
              <div className="ml-1">
                {message.status === 'sending' && (
                  <Clock className="w-3 h-3 text-primary-foreground/50 animate-pulse" />
                )}
                {message.status === 'failed' && (
                  <AlertCircle className="w-3 h-3 text-red-400" />
                )}
                {message.status === 'sent' && (
                  <Check className="w-3 h-3 text-primary-foreground/70" />
                )}
                {message.status === 'delivered' && !message.is_read && (
                  <CheckCheck className="w-3 h-3 text-primary-foreground/70" />
                )}
                {message.status === 'delivered' && message.is_read && (
                  <CheckCheck className="w-3 h-3 text-blue-400" />
                )}
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
