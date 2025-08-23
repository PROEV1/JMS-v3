import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, ArrowLeft, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface PartnerUser {
  id: string;
  user_id: string | null;
  partner_id: string;
  email?: string; // Make optional since it might not be in database yet
  role: 'partner_manufacturer' | 'partner_dealer' | 'partner_charger_manufacturer';
  permissions: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface Partner {
  id: string;
  name: string;
  partner_type: string;
  logo_url: string | null;
}

export default function AdminPartnerUsers() {
  const { id: partnerId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<PartnerUser | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role: '' as 'partner_manufacturer' | 'partner_dealer' | 'partner_charger_manufacturer' | '',
    permissions: {
      can_upload_jobs: true,
      can_view_jobs: true,
      can_edit_jobs: false,
      can_delete_jobs: false
    },
    is_active: true
  });

  // Fetch partner details
  const { data: partner } = useQuery({
    queryKey: ['partner', partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, partner_type, logo_url')
        .eq('id', partnerId)
        .single();
      
      if (error) throw error;
      return data as Partner;
    },
    enabled: !!partnerId
  });

  // Fetch partner users
  const { data: partnerUsers, isLoading } = useQuery({
    queryKey: ['partner-users', partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_users')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PartnerUser[];
    },
    enabled: !!partnerId
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('partner_users')
        .insert([{
          partner_id: partnerId,
          email: data.email,
          role: data.role,
          permissions: data.permissions,
          is_active: data.is_active
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-users', partnerId] });
      setShowDialog(false);
      resetForm();
      toast({ title: 'Partner user created successfully' });
    },
    onError: (error) => {
      console.error('Create user error:', error);
      toast({ title: 'Error creating partner user', description: error.message, variant: 'destructive' });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      const { error } = await supabase
        .from('partner_users')
        .update({
          email: data.email,
          role: data.role,
          permissions: data.permissions,
          is_active: data.is_active
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-users', partnerId] });
      setEditingUser(null);
      setShowDialog(false);
      resetForm();
      toast({ title: 'Partner user updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error updating partner user', description: error.message, variant: 'destructive' });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('partner_users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-users', partnerId] });
      toast({ title: 'Partner user deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error deleting partner user', description: error.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      email: '',
      role: '' as 'partner_manufacturer' | 'partner_dealer' | 'partner_charger_manufacturer' | '',
      permissions: {
        can_upload_jobs: true,
        can_view_jobs: true,
        can_edit_jobs: false,
        can_delete_jobs: false
      },
      is_active: true
    });
  };

  const handleEdit = (user: PartnerUser) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      role: user.role,
      permissions: user.permissions || {
        can_upload_jobs: true,
        can_view_jobs: true,
        can_edit_jobs: false,
        can_delete_jobs: false
      },
      is_active: user.is_active
    });
    setShowDialog(true);
  };

  const handleCreate = () => {
    resetForm();
    setEditingUser(null);
    setShowDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with data:', formData);
    console.log('editingUser:', editingUser);
    
    if (!formData.role) {
      toast({ title: 'Error', description: 'Please select a role', variant: 'destructive' });
      return;
    }
    
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, ...formData });
    } else {
      createUserMutation.mutate(formData);
    }
  };

  const handleDelete = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  if (isLoading || !partner) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/partners')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Partners
        </Button>
        
        <div className="flex items-center gap-3">
          {partner.logo_url && (
            <img src={partner.logo_url} alt={`${partner.name} logo`} className="h-8 w-auto rounded" />
          )}
          <div>
            <h1 className="text-2xl font-bold">{partner.name} - Users</h1>
            <p className="text-muted-foreground flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {partner.partner_type}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Partner Users</h2>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit Partner User' : 'Create Partner User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(value: 'partner_manufacturer' | 'partner_dealer' | 'partner_charger_manufacturer') => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner_manufacturer">Partner Manufacturer</SelectItem>
                  <SelectItem value="partner_dealer">Partner Dealer</SelectItem>
                  <SelectItem value="partner_charger_manufacturer">Partner Charger Manufacturer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Permissions</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="can_upload_jobs"
                    checked={formData.permissions.can_upload_jobs}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      permissions: { ...formData.permissions, can_upload_jobs: checked } 
                    })}
                  />
                  <Label htmlFor="can_upload_jobs">Can Upload Jobs</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="can_view_jobs"
                    checked={formData.permissions.can_view_jobs}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      permissions: { ...formData.permissions, can_view_jobs: checked } 
                    })}
                  />
                  <Label htmlFor="can_view_jobs">Can View Jobs</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="can_edit_jobs"
                    checked={formData.permissions.can_edit_jobs}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      permissions: { ...formData.permissions, can_edit_jobs: checked } 
                    })}
                  />
                  <Label htmlFor="can_edit_jobs">Can Edit Jobs</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="can_delete_jobs"
                    checked={formData.permissions.can_delete_jobs}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      permissions: { ...formData.permissions, can_delete_jobs: checked } 
                    })}
                  />
                  <Label htmlFor="can_delete_jobs">Can Delete Jobs</Label>
                </div>
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
                {editingUser ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {partnerUsers?.map((user) => (
          <Card key={user.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {user.email || 'No email'}
                  <Badge variant={user.is_active ? 'default' : 'secondary'}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">
                    {user.role?.replace('partner_', '')}
                  </Badge>
                </CardTitle>
                <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                  {user.permissions?.can_upload_jobs && <span>Upload Jobs</span>}
                  {user.permissions?.can_view_jobs && <span>View Jobs</span>}
                  {user.permissions?.can_edit_jobs && <span>Edit Jobs</span>}
                  {user.permissions?.can_delete_jobs && <span>Delete Jobs</span>}
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(user)}
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
                      <AlertDialogTitle>Delete Partner User</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{user.email || 'this user'}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDelete(user.id)}
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
        
        {partnerUsers?.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No partner users found. Click "Add User" to create the first one.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}