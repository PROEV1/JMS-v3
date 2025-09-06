import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ProEVLogo } from '@/components/ProEVLogo';
import { WhatsAppChat } from '@/components/WhatsAppChat';

interface Client {
  id: string;
  full_name: string;
  email: string;
  user_id: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

export default function AdminMessages() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      // Get clients with their last message and unread count
      const { data: clientsWithMessages, error } = await supabase
        .rpc('get_clients_with_last_message');

      if (error) throw error;

      setClients(clientsWithMessages || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error",
        description: "Failed to load clients with messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.full_name.toLowerCase().includes(searchLower) ||
      client.email.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Pro EV Header */}
      <div className="flex items-center justify-between mb-8">
        <ProEVLogo variant="main" size="lg" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Pro EV Admin Portal</p>
          <p className="text-xs text-muted-foreground">Message Management</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl heading-large">Messages</h1>
          <p className="text-muted-foreground body-text">
            Select a client to view conversation
          </p>
        </div>
        <Button onClick={() => navigate('/admin')} variant="outline">
          Back to Admin
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Clients
            </CardTitle>
            <CardDescription>
              Select a client to view their messages
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Client List */}
            <div className="max-h-[500px] overflow-y-auto">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className={`p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedClientId === client.id ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => setSelectedClientId(client.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{client.full_name}</p>
                          {client.unread_count && client.unread_count > 0 && (
                            <Badge variant="secondary" className="text-xs px-2 py-0 bg-primary text-primary-foreground">
                              {client.unread_count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-1">{client.email}</p>
                        {client.last_message && (
                          <p className="text-sm text-muted-foreground truncate">
                            {client.last_message}
                          </p>
                        )}
                        {client.last_message_at && (
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {new Date(client.last_message_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/clients/${client.id}`);
                        }}
                        className="h-6 px-2 text-xs flex-shrink-0"
                      >
                        View Profile
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm">No clients found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <div className="lg:col-span-2">
          {selectedClientId ? (
            <WhatsAppChat 
              clientId={selectedClientId}
            />
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium">Select a client to start chatting</p>
                <p className="text-sm">Choose a client from the list to view their conversation</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}