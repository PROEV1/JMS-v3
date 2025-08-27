
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Search, FileText, Calendar, Plus, Eye, CheckCircle, Clock, XCircle, Send, Trash2, Edit } from 'lucide-react';
import { BrandPage, BrandContainer, BrandHeading1, BrandLoading, BrandBadge } from '@/components/brand';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface Quote {
  id: string;
  quote_number: string;
  total_cost: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  client: {
    id: string;
    full_name: string;
    email: string;
  };
}

export default function AdminQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      console.log('fetchQuotes: Starting to fetch quotes...');
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(
            id,
            full_name,
            email
          )
        `)
        .neq('quote_template', 'partner_import') // Hide partner import placeholder quotes
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('fetchQuotes: Received data:', data?.length || 0, 'quotes');
      setQuotes(data || []);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast({
        title: "Error",
        description: "Failed to load quotes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.client?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getQuotesByStatus = (status: string) => {
    return quotes.filter(quote => quote.status === status).length;
  };

  const kpiData = [
    {
      title: 'Total Quotes',
      value: quotes.length,
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      filterValue: 'all'
    },
    {
      title: 'Accepted Quotes',
      value: getQuotesByStatus('accepted'),
      icon: CheckCircle,
      color: 'text-brand-green',
      bgColor: 'bg-brand-green/10',
      filterValue: 'accepted'
    },
    {
      title: 'Pending Quotes',
      value: getQuotesByStatus('sent'),
      icon: Clock,
      color: 'text-brand-pink',
      bgColor: 'bg-brand-pink/10',
      filterValue: 'sent'
    },
    {
      title: 'Rejected Quotes',
      value: getQuotesByStatus('declined'),
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      filterValue: 'declined'
    }
  ];

  const handleQuoteClick = (quoteId: string) => {
    navigate(`/admin/quotes/${quoteId}`);
  };

  const handleClientClick = (clientId: string) => {
    navigate(`/admin/clients/${clientId}`);
  };

  const handleDeleteQuote = async (quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('Attempting to delete quote:', quoteId);
      
      // First check if there are any orders associated with this quote
      const { data: orders, error: orderCheckError } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('quote_id', quoteId);

      if (orderCheckError) {
        console.error('Error checking for orders:', orderCheckError);
        throw orderCheckError;
      }

      if (orders && orders.length > 0) {
        const orderNumbers = orders.map(o => o.order_number).join(', ');
        toast({
          title: "Cannot Delete Quote",
          description: `This quote has associated orders (${orderNumbers}). Delete the orders first.`,
          variant: "destructive",
        });
        return;
      }

      // Delete quote items first
      const { error: deleteItemsError } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', quoteId);

      if (deleteItemsError) {
        console.error('Error deleting quote items:', deleteItemsError);
        throw deleteItemsError;
      }

      // Then delete the quote
      const { error: deleteQuoteError } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (deleteQuoteError) {
        console.error('Error deleting quote:', deleteQuoteError);
        throw deleteQuoteError;
      }

      console.log('Quote deletion successful');
      
      // Check if the quote still exists after deletion
      const { data: checkData, error: checkError } = await supabase
        .from('quotes')
        .select('id, quote_number')
        .eq('id', quoteId);
        
      if (checkError) {
        console.error('Error checking if quote still exists:', checkError);
      } else {
        console.log('Checking if quote still exists after deletion:', checkData);
        if (checkData && checkData.length > 0) {
          console.error('ERROR: Quote still exists after deletion attempt!');
        } else {
          console.log('SUCCESS: Quote no longer exists in database');
        }
      }
      
      // Refresh the list and log results
      console.log('Refreshing quotes after deletion...');
      await fetchQuotes();
      console.log('Quotes refreshed, new count should be updated');

      toast({
        title: "Success",
        description: "Quote deleted successfully",
      });
      
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: "Error",
        description: `Failed to delete quote: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleKpiFilter = (status: string) => {
    setStatusFilter(status);
  };

  const handleCreateQuote = () => {
    navigate('/admin/quotes/create');
  };

  const handleEditQuote = (quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/admin/quotes/${quoteId}/edit`);
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
            <BrandHeading1>Quotes</BrandHeading1>
            <Button className="btn-brand-primary" onClick={handleCreateQuote}>
              <Plus className="h-4 w-4 mr-2" />
              Create Quote
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {kpiData.map((kpi, index) => (
              <Card 
                key={index} 
                className="brand-card cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleKpiFilter(kpi.filterValue)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${kpi.bgColor}`}>
                      <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                      <p className="text-2xl font-bold text-primary">{kpi.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Unified Filter Bar */}
          <Card className="border border-border shadow-sm rounded-lg">
            <CardContent className="px-6 py-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Left: Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search quotes or clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 text-sm"
                  />
                </div>
                
                {/* Right: Filters */}
                <div className="flex gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48 h-10 text-sm">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="sent">Pending</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="declined">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quotes Table */}
          <Card className="border border-border shadow-sm rounded-lg">
            <CardContent className="px-6 py-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto">Quote</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto">Client</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto hidden sm:table-cell">Email</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto text-right">Amount</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto hidden md:table-cell">Created</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto hidden lg:table-cell">Expires</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.map((quote) => (
                      <TableRow 
                        key={quote.id}
                        className="border-b border-border hover:bg-muted/50 transition-colors h-16 cursor-pointer"
                        onClick={() => handleQuoteClick(quote.id)}
                      >
                        <TableCell className="py-4 align-middle">
                          <div className="text-sm font-medium text-foreground leading-none truncate">
                            Quote {quote.quote_number}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="space-y-1">
                            <button 
                              className="text-sm font-medium text-primary hover:text-[hsl(var(--primary-hover))] underline leading-none truncate block" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClientClick(quote.client.id);
                              }}
                            >
                              {quote.client?.full_name}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle hidden sm:table-cell">
                          <div className="text-xs text-muted-foreground truncate">
                            {quote.client?.email}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle text-right">
                          <div className="text-sm font-semibold text-foreground">
                            {formatCurrency(quote.total_cost)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle hidden md:table-cell">
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(quote.created_at), 'dd MMM yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle hidden lg:table-cell">
                          <div className="text-xs text-muted-foreground">
                            {quote.expires_at ? format(new Date(quote.expires_at), 'dd MMM yyyy') : '-'}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <BrandBadge 
                            status={quote.status as 'sent' | 'accepted' | 'declined' | 'pending'}
                            className="text-xs uppercase font-semibold px-2 py-1"
                          >
                            {quote.status === 'sent' ? 'Pending' : 
                             quote.status === 'declined' ? 'Rejected' :
                             quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                          </BrandBadge>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="flex items-center gap-2 justify-end">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 px-3 text-xs font-medium" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuoteClick(quote.id);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 px-3 text-xs font-medium" 
                              onClick={(e) => handleEditQuote(quote.id, e)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="h-8 px-3 text-xs font-medium" 
                              onClick={(e) => handleDeleteQuote(quote.id, e)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {filteredQuotes.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold brand-heading-3">No quotes found</h3>
                <p className="text-muted-foreground brand-body">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search terms or filters.' 
                    : 'Get started by creating your first quote.'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </BrandContainer>
    </BrandPage>
  );
}
