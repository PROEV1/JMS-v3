import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  isGrouped?: boolean;
}

const formatRole = (role: string) => {
  switch (role) {
    case 'admin':
      return 'Pro EV Team';
    case 'engineer':
      return 'Engineer';
    case 'client':
      return 'Client';
    case 'manager':
      return 'Manager';
    case 'standard_office_user':
      return 'Office';
    default:
      return role.replace('_', ' ');
  }
};

const getRoleInitials = (role: string) => {
  switch (role) {
    case 'admin':
      return 'PS';
    case 'engineer':
      return 'EN';
    case 'client':
      return 'CL';
    case 'manager':
      return 'MG';
    case 'standard_office_user':
      return 'OF';
    default:
      return 'US';
  }
};

export default function ChatBubble({ 
  message, 
  isOwn, 
  showAvatar = true,
  senderName,
  isGrouped = false
}: ChatBubbleProps) {
  return (
    <div className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''} ${isGrouped ? 'mt-1' : 'mt-4'}`}>
      {/* Avatar */}
      {showAvatar && !isGrouped && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className={`text-sm font-medium ${
            isOwn 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground'
          }`}>
            {senderName 
              ? senderName.split(' ').map(n => n[0]).join('').toUpperCase()
              : getRoleInitials(message.sender_role)
            }
          </AvatarFallback>
        </Avatar>
      )}

      {/* Spacer for grouped messages */}
      {showAvatar && isGrouped && (
        <div className="h-8 w-8 flex-shrink-0" />
      )}

      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender info - only show for first message in group */}
        {!isOwn && showAvatar && !isGrouped && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">
              {senderName || formatRole(message.sender_role)}
            </span>
            <Badge variant="secondary" className="text-xs px-2 py-0">
              {formatRole(message.sender_role)}
            </Badge>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-2 max-w-full break-words transition-all ${
            isOwn
              ? `bg-primary text-primary-foreground ${isGrouped ? 'rounded-br-md' : 'rounded-br-sm'}`
              : `bg-muted text-foreground ${isGrouped ? 'rounded-bl-md' : 'rounded-bl-sm'}`
          }`}
        >
          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isOwn ? 'text-white' : ''}`}>
            {message.content}
          </p>
        </div>

        {/* Message meta info - only show for last message in group or single messages */}
        {!isGrouped && (
          <div className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${
            isOwn ? 'flex-row-reverse' : ''
          }`}>
            <span>
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
            
            {/* Delivery status for own messages */}
            {isOwn && (
              <div className="flex items-center">
                {message.status === 'sending' && (
                  <Clock className="w-3 h-3 text-muted-foreground" />
                )}
                {message.status === 'failed' && (
                  <AlertCircle className="w-3 h-3 text-destructive" />
                )}
                {message.status === 'sent' && (
                  <Check className="w-3 h-3 text-muted-foreground" />
                )}
                {message.status === 'delivered' && message.is_read && (
                  <CheckCheck className="w-3 h-3 text-primary" />
                )}
                {message.status === 'delivered' && !message.is_read && (
                  <CheckCheck className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}