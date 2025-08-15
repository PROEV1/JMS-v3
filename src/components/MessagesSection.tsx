
import WhatsAppChat from './WhatsAppChat';

interface MessagesSectionProps {
  clientId?: string;
  quoteId?: string;
  projectId?: string;
  title?: string;
}

export default function MessagesSection({ 
  clientId, 
  quoteId, 
  projectId, 
  title = "Messages" 
}: MessagesSectionProps) {
  return (
    <WhatsAppChat 
      clientId={clientId}
      quoteId={quoteId}
      projectId={projectId}
      title={title}
    />
  );
}
