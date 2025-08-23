
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Users, Settings, Upload, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface Partner {
  id: string;
  name: string;
  slug: string | null;
  base_url: string | null;
  logo_url: string | null;
  partner_type: 'manufacturer' | 'dealer' | 'charger_manufacturer' | null;
  brand_colors: any;
  parent_partner_id: string | null;
  is_active: boolean;
  client_payment_required: boolean;
  client_agreement_required: boolean;
  client_survey_required: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminPartners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    base_url: '',
    logo_url: '',
    partner_type: '' as 'manufacturer' | 'dealer' | 'charger_manufacturer' | '',
    brand_colors: { primary: '#000000', secondary: '#ffffff' },
    parent_partner_id: '',
    is_active: true,
    client_payment_required: true,
    client_agreement_required: true,
    client_survey_required: true
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

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
      let logoUrl = data.logo_url;
      
      // Upload logo if file is provided
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('partner-logos')
          .upload(fileName, logoFile);
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('partner-logos')
          .getPublicUrl(fileName);
        logoUrl = publicUrl;
      }
      
      const { error } = await supabase
        .from('partners')
        .insert([{
          name: data.name,
          slug: data.slug || null,
          base_url: data.base_url || null,
          logo_url: logoUrl || null,
          partner_type: data.partner_type || null,
          brand_colors: data.brand_colors,
          parent_partner_id: data.parent_partner_id || null,
          is_active: data.is_active,
          client_payment_required: data.client_payment_required,
          client_agreement_required: data.client_agreement_required,
          client_survey_required: data.client_survey_required ?? true
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setShowDialog(false);
      resetForm();
      toast({ title: 'Partner created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error creating partner', description: error.message, variant: 'destructive' });
    }
  });

  const updatePartnerMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      let logoUrl = data.logo_url;
      
      // Upload new logo if file is provided
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('partner-logos')
          .upload(fileName, logoFile);
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('partner-logos')
          .getPublicUrl(fileName);
        logoUrl = publicUrl;
      }
      
      const { error } = await supabase
        .from('partners')
        .update({
          name: data.name,
          slug: data.slug || null,
          base_url: data.base_url || null,
          logo_url: logoUrl || null,
          partner_type: data.partner_type || null,
          brand_colors: data.brand_colors,
          parent_partner_id: data.parent_partner_id || null,
          is_active: data.is_active,
          client_payment_required: data.client_payment_required,
          client_agreement_required: data.client_agreement_required,
          client_survey_required: data.client_survey_required ?? true
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setEditingPartner(null);
      setShowDialog(false);
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
      logo_url: '',
      partner_type: '' as 'manufacturer' | 'dealer' | 'charger_manufacturer' | '',
      brand_colors: { primary: '#000000', secondary: '#ffffff' },
      parent_partner_id: '',
      is_active: true,
      client_payment_required: true,
      client_agreement_required: true,
      client_survey_required: true
    });
    setLogoFile(null);
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      slug: partner.slug || '',
      base_url: partner.base_url || '',
      logo_url: partner.logo_url || '',
      partner_type: partner.partner_type || '' as 'manufacturer' | 'dealer' | 'charger_manufacturer' | '',
      brand_colors: partner.brand_colors || { primary: '#000000', secondary: '#ffffff' },
      parent_partner_id: partner.parent_partner_id || '',
      is_active: partner.is_active,
      client_payment_required: partner.client_payment_required,
      client_agreement_required: partner.client_agreement_required,
      client_survey_required: partner.client_survey_required ?? true
    });
    setLogoFile(null);
    setShowDialog(true);
  };

  const handleCreate = () => {
    resetForm();
    setEditingPartner(null);
    setShowDialog(true);
  };

  const deletePartnerMutation = useMutation({
    mutationFn: async (partnerId: string) => {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', partnerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast({ title: 'Partner deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error deleting partner', description: error.message, variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPartner) {
      updatePartnerMutation.mutate({ id: editingPartner.id, ...formData });
    } else {
      createPartnerMutation.mutate(formData);
    }
  };

  const handleDelete = (partnerId: string) => {
    deletePartnerMutation.mutate(partnerId);
  };

  if (isLoading) {
    return <div className="p-6">Loading partners...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Partner Management</h1>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Partner
        </Button>
        
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
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
                <Label htmlFor="partner_type">Partner Type</Label>
                <Select value={formData.partner_type} onValueChange={(value: 'manufacturer' | 'dealer' | 'charger_manufacturer') => setFormData({ ...formData, partner_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select partner type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manufacturer">Manufacturer</SelectItem>
                    <SelectItem value="dealer">Dealer</SelectItem>
                    <SelectItem value="charger_manufacturer">Charger Manufacturer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.partner_type === 'dealer' && partners && (
                <div>
                  <Label htmlFor="parent_partner_id">Parent Manufacturer</Label>
                  <Select value={formData.parent_partner_id} onValueChange={(value) => setFormData({ ...formData, parent_partner_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.filter(p => p.partner_type === 'manufacturer' || p.partner_type === 'charger_manufacturer').map(partner => (
                        <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="logo">Logo</Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
                {formData.logo_url && (
                  <div className="mt-2">
                    <img src={formData.logo_url} alt="Current logo" className="h-12 w-auto rounded" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary_color">Primary Brand Color</Label>
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.brand_colors.primary}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      brand_colors: { ...formData.brand_colors, primary: e.target.value } 
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="secondary_color">Secondary Brand Color</Label>
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.brand_colors.secondary}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      brand_colors: { ...formData.brand_colors, secondary: e.target.value } 
                    })}
                  />
                </div>
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
                <div className="flex items-center space-x-2">
                  <Switch
                    id="client_survey_required"
                    checked={formData.client_survey_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, client_survey_required: checked })}
                  />
                  <Label htmlFor="client_survey_required">Client Survey Required</Label>
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
                  onClick={() => setShowDialog(false)}
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
              <div className="flex gap-4">
                {partner.logo_url && (
                  <img src={partner.logo_url} alt={`${partner.name} logo`} className="h-12 w-auto rounded" />
                )}
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {partner.name}
                    <Badge variant={partner.is_active ? 'default' : 'secondary'}>
                      {partner.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {partner.partner_type && (
                      <Badge variant="outline">
                        {partner.partner_type === 'manufacturer' ? <Building2 className="h-3 w-3 mr-1" /> : null}
                        {partner.partner_type === 'charger_manufacturer' ? 'Charger Manufacturer' : partner.partner_type}
                      </Badge>
                    )}
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
                    {!partner.client_survey_required && (
                      <Badge variant="outline" className="text-xs">Survey Not Required</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/partners/${partner.id}/users`)}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Users
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/partners/${partner.id}/profiles`)}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Profiles
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(partner)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Partner</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{partner.name}"? This action cannot be undone and will remove all associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDelete(partner.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

    </div>
  );
}
