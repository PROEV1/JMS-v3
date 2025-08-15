import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Search, Edit, Trash2, MoreHorizontal, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Component to show client link indicator
function ClientLinkIndicator({ userId }: { userId: string }) {
  const [hasClientProfile, setHasClientProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkClientProfile = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      setHasClientProfile(!!data);
      setLoading(false);
    };

    checkClientProfile();
  }, [userId]);

  if (loading) return null;

  return hasClientProfile ? (
    <Badge variant="outline" className="text-xs">
      ✓ Linked
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-xs">
      No Profile
    </Badge>
  );
}

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
}

export default function AdminClientUsers() {
  const navigate = useNavigate();
  const { canManageUsers, canCreateUsers, canDeleteUsers, loading: permissionsLoading } = usePermissions();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  useEffect(() => {
    if (!permissionsLoading && !canManageUsers) {
      toast.error('You do not have permission to access user management');
      navigate('/admin');
      return;
    }

    if (!permissionsLoading) {
      fetchUsers();
    }
  }, [permissionsLoading, canManageUsers, navigate]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client') // Only fetch client users
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching client users:', error);
      toast.error('Failed to fetch client users');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('user_id', userId);

      if (error) throw error;

      // Log the action
      await supabase.rpc('log_user_action', {
        p_action_type: 'status_change',
        p_target_user_id: userId,
        p_details: { old_status: currentStatus, new_status: newStatus }
      });

      toast.success(`Client ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating client status:', error);
      toast.error('Failed to update client status');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!canDeleteUsers) {
      toast.error('You do not have permission to delete users');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return;
    }

    try {
      // First, log the action
      await supabase.rpc('log_user_action', {
        p_action_type: 'user_deleted',
        p_target_user_id: userId,
        p_details: { user_name: userName }
      });

      // Delete the user profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Client deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Failed to delete client');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    return status === 'active' ? 'default' : 'secondary';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRegion = regionFilter === 'all' || user.region === regionFilter;

    return matchesSearch && matchesStatus && matchesRegion;
  });

  const regions = Array.from(new Set(users.map(u => u.region).filter(Boolean)));

  if (permissionsLoading || loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Users</h1>
          <p className="text-muted-foreground">Manage client portal users and their access</p>
        </div>
        {canCreateUsers && (
          <Button onClick={() => navigate('/admin/users/new')}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Client User
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Portal Users</CardTitle>
          <div className="flex gap-4 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search client users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {regions.length > 0 && (
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map(region => (
                    <SelectItem key={region} value={region!}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{user.full_name || 'No name'}</span>
                      <ClientLinkIndicator userId={user.user_id} />
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.region || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(user.status)}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.last_login ? format(new Date(user.last_login), 'MMM dd, yyyy') : 'Never'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/users/${user.user_id}`)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={async () => {
                            // Find linked client profile
                            const { data } = await supabase
                              .from('clients')
                              .select('id')
                              .eq('user_id', user.user_id)
                              .single();
                            
                            if (data) {
                              navigate(`/admin/clients/${data.id}`);
                            }
                          }}
                        >
                          <User className="h-4 w-4 mr-2" />
                          View Client Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleStatusToggle(user.user_id, user.status)}
                        >
                          {user.status === 'active' ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        {canDeleteUsers && (
                          <DropdownMenuItem 
                            onClick={() => handleDeleteUser(user.user_id, user.full_name || user.email)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}