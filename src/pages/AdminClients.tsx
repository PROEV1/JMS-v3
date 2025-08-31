import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Search, User, Mail, Phone, MapPin, Calendar, Plus } from 'lucide-react';
import { BrandPage, BrandContainer, BrandHeading1, BrandLoading } from '@/components/brand';
import { CreateClientModal } from '@/components/CreateClientModal';
import { useServerPagination } from '@/hooks/useServerPagination';
import { Paginator } from '@/components/ui/Paginator';

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  user_id: string;
}

export default function AdminClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [thisMonthCount, setThisMonthCount] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { pagination, controls } = useServerPagination(25);

  const handleAddClient = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = (newClient: any) => {
    setIsCreateModalOpen(false);
    fetchClients(); // Refresh the list
    toast({
      title: "Success",
      description: "Client created successfully",
    });
  };

  // Reset to first page when search term changes
  useEffect(() => {
    controls.resetToFirstPage();
  }, [searchTerm]);

  useEffect(() => {
    fetchClients();
  }, [pagination.page, pagination.pageSize, searchTerm]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      
      // Build the query
      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply search filter if present
      if (searchTerm.trim()) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      // Apply pagination
      const { data, error, count } = await query
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) throw error;
      
      setClients(data || []);
      setTotalCount(count || 0);

      // Fetch this month's count separately
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: monthCount, error: monthError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());

      if (monthError) throw monthError;
      setThisMonthCount(monthCount || 0);

    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (client: Client) => {
    if (!confirm(`Are you sure you want to delete client "${client.full_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('admin-delete-client', {
        body: { 
          clientId: client.id,
          userId: client.user_id 
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Client deleted successfully",
      });

      // Refresh the clients list
      fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: "Error", 
        description: "Failed to delete client",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <BrandLoading />;
  }

  return (
    <BrandPage>
      <BrandContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <BrandHeading1>Clients</BrandHeading1>
            <Button className="btn-brand-primary" onClick={handleAddClient}>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                    <p className="text-2xl font-bold text-primary">{totalCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-brand-green" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">This Month</p>
                    <p className="text-2xl font-bold text-primary">{thisMonthCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Clients List */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} className="brand-card-interactive">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium brand-body">
                            {client.full_name
                              .split(' ')
                              .map(name => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())
                              .join(' ')
                            }
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="brand-body">{client.email}</TableCell>
                    <TableCell className="brand-body">{client.phone || '-'}</TableCell>
                    <TableCell className="brand-body">
                      <div className="max-w-xs truncate">
                        {client.address || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="brand-body">
                      {new Date(client.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="badge-teal">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/admin/clients/${client.id}`)}
                        >
                          View Details
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeleteClient(client)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {totalCount > 0 && (
              <div className="px-6 py-4 border-t">
                <Paginator
                  currentPage={pagination.page}
                  pageSize={pagination.pageSize}
                  totalItems={totalCount}
                  onPageChange={controls.setPage}
                  onPageSizeChange={controls.setPageSize}
                />
              </div>
            )}
          </Card>

          {clients.length === 0 && !loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold brand-heading-3">No clients found</h3>
                <p className="text-muted-foreground brand-body">
                  {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding your first client.'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <CreateClientModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      </BrandContainer>
    </BrandPage>
  );
}