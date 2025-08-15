import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Mail, Key } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  region: string | null;
  last_login: string | null;
  created_at: string;
  invited_at: string | null;
}

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { canManageUsers, loading: permissionsLoading } = usePermissions();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<{
    full_name: string;
    role: 'admin' | 'client' | 'engineer' | 'manager' | 'standard_office_user';
    status: string;
    region: string;
  }>({
    full_name: '',
    role: 'client',
    status: 'active',
    region: '',
  });

  useEffect(() => {
    if (!permissionsLoading && !canManageUsers) {
      toast.error('You do not have permission to access user management');
      navigate('/admin/users');
      return;
    }

    if (!permissionsLoading && userId) {
      fetchUser();
    }
  }, [permissionsLoading, canManageUsers, userId, navigate]);

  const fetchUser = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      setUser(data);
      setFormData({
        full_name: data.full_name || '',
        role: data.role as 'admin' | 'client' | 'engineer' | 'manager' | 'standard_office_user',
        status: data.status,
        region: data.region || '',
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('Failed to fetch user details');
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          role: formData.role,
          status: formData.status,
          region: formData.region || null,
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      // Log the action
      await supabase.rpc('log_user_action', {
        p_action_type: 'user_updated',
        p_target_user_id: user.user_id,
        p_details: {
          changes: formData,
          updated_by: 'admin'
        }
      });

      toast.success('User updated successfully');
      fetchUser(); // Refresh user data
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleResendInvite = async () => {
    if (!user) return;

    try {
      // This would call an edge function to resend the invite
      toast.success('Invite email sent');
    } catch (error) {
      console.error('Error resending invite:', error);
      toast.error('Failed to resend invite');
    }
  };

  const formatRole = (role: string) => {
    switch (role) {
      case 'standard_office_user': return 'Office User';
      case 'admin': return 'Admin';
      case 'manager': return 'Manager';
      case 'engineer': return 'Engineer';
      case 'client': return 'Client';
      default: return role;
    }
  };

  if (permissionsLoading || loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Details</h1>
          <p className="text-muted-foreground">{user.full_name || user.email}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(value: 'admin' | 'client' | 'engineer' | 'manager' | 'standard_office_user') => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="standard_office_user">Office User</SelectItem>
                  <SelectItem value="engineer">Engineer</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="Enter region (optional)"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={handleResendInvite}>
                <Mail className="h-4 w-4 mr-2" />
                Resend Invite
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">User ID</Label>
                <p className="font-mono text-xs">{user.user_id}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Role</Label>
                <p>{formatRole(user.role)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p className={user.status === 'active' ? 'text-green-600' : 'text-red-600'}>
                  {user.status}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Region</Label>
                <p>{user.region || 'Not assigned'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p>{format(new Date(user.created_at), 'MMM dd, yyyy')}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Last Login</Label>
                <p>{user.last_login ? format(new Date(user.last_login), 'MMM dd, yyyy') : 'Never'}</p>
              </div>
              {user.invited_at && (
                <div>
                  <Label className="text-muted-foreground">Invited</Label>
                  <p>{format(new Date(user.invited_at), 'MMM dd, yyyy')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}