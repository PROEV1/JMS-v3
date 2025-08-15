import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { User, Mail, Phone, MapPin, Calendar, Save, Edit2, X } from 'lucide-react';
import { PortalAccessPanel } from './PortalAccessPanel';

interface Client {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  user_id: string | null;
}

interface ClientProfileProps {
  clientId: string;
  onClose?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ 
  clientId, 
  onClose,
  showBackButton = false,
  onBack
}) => {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClient();
  }, [clientId]);

  const loadClient = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) {
        console.error('Error fetching client:', error);
        toast.error('Failed to load client');
      } else {
        setClient(data);
        setEditData(data);
      }
    } catch (error) {
      console.error('Error loading client:', error);
      toast.error('Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update(editData)
        .eq('id', clientId);

      if (error) {
        console.error('Error updating client:', error);
        toast.error('Failed to update client');
      } else {
        toast.success('Client updated successfully');
        setIsEditing(false);
        loadClient();
      }
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Client not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              ← Back
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold">{client.full_name}</h2>
            <p className="text-muted-foreground">{client.email}</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Client Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Client Information
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Full Name</label>
                      <Input
                        value={editData.full_name as string}
                        onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input
                        value={editData.email as string}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        placeholder="Email address"
                        type="email"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Phone</label>
                      <Input
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        placeholder="Phone number"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Postcode</label>
                      <Input
                        value={editData.postcode || ''}
                        onChange={(e) => setEditData({ ...editData, postcode: e.target.value })}
                        placeholder="Postcode"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Address</label>
                    <Textarea
                      value={editData.address || ''}
                      onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                      placeholder="Full address"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveChanges} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{client.phone}</span>
                      </div>
                    )}
                  </div>
                  {client.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-sm">{client.address}</span>
                    </div>
                  )}
                  {client.postcode && (
                    <div>
                      <Badge variant="outline">{client.postcode}</Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Created {new Date(client.created_at).toLocaleDateString()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quotes</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Implement quotes list here */}
              <p className="text-muted-foreground">No quotes available</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Implement orders list here */}
              <p className="text-muted-foreground">No orders available</p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Portal Access & Actions */}
        <div className="space-y-6">
          {/* Portal Access Panel */}
          <PortalAccessPanel client={client} />

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="destructive" className="w-full">
                Delete Client
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
