import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, UserPlus, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';

export default function AdminUserInvite() {
  const navigate = useNavigate();
  const { canCreateUsers, loading: permissionsLoading } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'client' as 'admin' | 'client' | 'engineer' | 'manager' | 'standard_office_user',
    region: '',
  });

  useEffect(() => {
    if (!permissionsLoading && !canCreateUsers) {
      toast.error('You do not have permission to create users');
      navigate('/admin/users');
    }
  }, [permissionsLoading, canCreateUsers, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast.error('Email is required');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-user-invite', {
        body: {
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          region: formData.region,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('User created successfully!');
      navigate('/admin/users');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    } finally {
      setLoading(false);
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

  if (permissionsLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invite New User</h1>
          <p className="text-muted-foreground">Send an invitation to join the platform</p>
        </div>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            User Invitation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={formData.role} onValueChange={(value: 'admin' | 'client' | 'engineer' | 'manager' | 'standard_office_user') => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full platform access</SelectItem>
                  <SelectItem value="manager">Manager - All except user management</SelectItem>
                  <SelectItem value="standard_office_user">Office User - Limited access</SelectItem>
                  <SelectItem value="engineer">Engineer - Job-focused access</SelectItem>
                  <SelectItem value="client">Client - View own data only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="e.g., London, Manchester (optional)"
              />
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={loading} className="w-full">
                <Mail className="h-4 w-4 mr-2" />
                {loading ? 'Sending Invitation...' : 'Send Invitation'}
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Selected Role: {formatRole(formData.role)}</h4>
            <div className="text-sm text-muted-foreground">
              {formData.role === 'admin' && (
                <p>• Full platform access including user management and system settings</p>
              )}
              {formData.role === 'manager' && (
                <p>• Access to all features except user management and creation</p>
              )}
              {formData.role === 'standard_office_user' && (
                <p>• Access to quotes, orders, clients, messages, and scheduling</p>
              )}
              {formData.role === 'engineer' && (
                <p>• Limited to assigned jobs, uploads, and completion tasks</p>
              )}
              {formData.role === 'client' && (
                <p>• Can only view their own quotes, orders, and messages</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}