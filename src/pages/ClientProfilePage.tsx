import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ClientProfile } from '@/components/ClientProfile';

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  user_id: string | null;
}

export default function ClientProfilePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clientId) {
      loadClient();
    }
  }, [clientId]);

  const loadClient = async () => {
    if (!clientId) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, email, phone, address, created_at, user_id')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      setClient(data);
    } catch (error) {
      console.error('Error loading client:', error);
      toast({
        title: "Error",
        description: "Failed to load client",
        variant: "destructive",
      });
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">Client not found</p>
      </div>
    );
  }

  return <ClientProfile client={client} onBack={handleBack} />;
}