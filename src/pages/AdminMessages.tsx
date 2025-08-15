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
import { ProSpacesLogo } from '@/components/ProSpacesLogo';
import WhatsAppChat from '@/components/WhatsAppChat';

interface Client {
  id: string;
  full_name: string;
  email: string;
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
      // First get all client IDs who have sent messages
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('sender_id')
        .not('sender_id', 'is', null);

      if (messageError) throw messageError;

      // Get unique sender IDs
      const senderIds = [...new Set(messageData?.map(m => m.sender_id) || [])];

      if (senderIds.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      // Now get clients whose user_id matches any of the sender IDs
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, full_name, email, user_id')
        .in('user_id', senderIds)
        .order('full_name');

      if (clientError) throw clientError;

      setClients(clientData || []);
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
      {/* ProSpaces Header */}
      <div className="flex items-center justify-between mb-8">
        <ProSpacesLogo variant="main" size="lg" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">ProSpaces Admin Portal</p>
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
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{client.full_name}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/clients/${client.id}`);
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          View Profile
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">{client.email}</p>
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
              title={`Chat with ${filteredClients.find(c => c.id === selectedClientId)?.full_name || 'Client'}`}
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