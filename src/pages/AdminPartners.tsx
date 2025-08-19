
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, FileSpreadsheet, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Partner {
  id: string;
  name: string;
  slug: string | null;
  base_url: string | null;
  is_active: boolean;
  client_payment_required: boolean;
  client_agreement_required: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminPartners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    base_url: '',
    is_active: true,
    client_payment_required: true,
    client_agreement_required: true
  });

  const { data: partners, isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Partner[];
    }
  });

  const createPartnerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('partners')
        .insert([{
          name: data.name,
          slug: data.slug || null,
          base_url: data.base_url || null,
          is_active: data.is_active,
          client_payment_required: data.client_payment_required,
          client_agreement_required: data.client_agreement_required
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: 'Partner created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error creating partner', description: error.message, variant: 'destructive' });
    }
  });

  const updatePartnerMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      const { error } = await supabase
        .from('partners')
        .update({
          name: data.name,
          slug: data.slug || null,
          base_url: data.base_url || null,
          is_active: data.is_active,
          client_payment_required: data.client_payment_required,
          client_agreement_required: data.client_agreement_required
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setEditingPartner(null);
      resetForm();
      toast({ title: 'Partner updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error updating partner', description: error.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({ 
      name: '', 
      slug: '', 
      base_url: '', 
      is_active: true,
      client_payment_required: true,
      client_agreement_required: true
    });
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      slug: partner.slug || '',
      base_url: partner.base_url || '',
      is_active: partner.is_active,
      client_payment_required: partner.client_payment_required,
      client_agreement_required: partner.client_agreement_required
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPartner) {
      updatePartnerMutation.mutate({ id: editingPartner.id, ...formData });
    } else {
      createPartnerMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading partners...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Partner Management</h1>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingPartner(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPartner ? 'Edit Partner' : 'Create Partner'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Partner Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug (optional)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="partner-name"
                />
              </div>
              <div>
                <Label htmlFor="base_url">Base URL (optional)</Label>
                <Input
                  id="base_url"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  placeholder="https://partner-jms.com"
                />
              </div>
              
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Client Requirements</h3>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="client_payment_required"
                    checked={formData.client_payment_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, client_payment_required: checked })}
                  />
                  <Label htmlFor="client_payment_required">Client Payment Required</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="client_agreement_required"
                    checked={formData.client_agreement_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, client_agreement_required: checked })}
                  />
                  <Label htmlFor="client_agreement_required">Client Agreement Required</Label>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => editingPartner ? setEditingPartner(null) : setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingPartner ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {partners?.map((partner) => (
          <Card key={partner.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {partner.name}
                  <Badge variant={partner.is_active ? 'default' : 'secondary'}>
                    {partner.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </CardTitle>
                {partner.slug && (
                  <p className="text-sm text-muted-foreground">Slug: {partner.slug}</p>
                )}
                {partner.base_url && (
                  <p className="text-sm text-muted-foreground">URL: {partner.base_url}</p>
                )}
                <div className="flex gap-2 mt-2">
                  {!partner.client_payment_required && (
                    <Badge variant="outline" className="text-xs">Payment Not Required</Badge>
                  )}
                  {!partner.client_agreement_required && (
                    <Badge variant="outline" className="text-xs">Agreement Not Required</Badge>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/partners/${partner.id}/profiles`)}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Profiles
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(partner)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Partner</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="edit-name">Partner Name</Label>
                        <Input
                          id="edit-name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-slug">Slug (optional)</Label>
                        <Input
                          id="edit-slug"
                          value={formData.slug}
                          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                          placeholder="partner-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-base_url">Base URL (optional)</Label>
                        <Input
                          id="edit-base_url"
                          value={formData.base_url}
                          onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                          placeholder="https://partner-jms.com"
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium">Client Requirements</h3>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="edit-client_payment_required"
                            checked={formData.client_payment_required}
                            onCheckedChange={(checked) => setFormData({ ...formData, client_payment_required: checked })}
                          />
                          <Label htmlFor="edit-client_payment_required">Client Payment Required</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="edit-client_agreement_required"
                            checked={formData.client_agreement_required}
                            onCheckedChange={(checked) => setFormData({ ...formData, client_agreement_required: checked })}
                          />
                          <Label htmlFor="edit-client_agreement_required">Client Agreement Required</Label>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                        <Label htmlFor="edit-is_active">Active</Label>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setEditingPartner(null)}>
                          Cancel
                        </Button>
                        <Button type="submit">Update</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

    </div>
  );
}
