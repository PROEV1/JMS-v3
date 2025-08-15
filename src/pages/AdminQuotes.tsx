
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, FileText, Calendar, Plus, Eye, CheckCircle, Clock, XCircle, Send, Trash2, Edit } from 'lucide-react';
import { BrandPage, BrandContainer, BrandHeading1, BrandLoading, BrandBadge } from '@/components/brand';
import { useNavigate } from 'react-router-dom';

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
        .order('created_at', { ascending: false });

      if (error) throw error;
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
      color: 'text-brand-teal',
      bgColor: 'bg-brand-teal/10',
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
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Quote deleted successfully",
      });
      
      fetchQuotes(); // Refresh the list
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: "Error",
        description: "Failed to delete quote",
        variant: "destructive",
      });
    }
  };

  const handleKpiFilter = (status: string) => {
    setStatusFilter(status);
  };

  const handleCreateQuote = () => {
    navigate('/admin/quotes/new');
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

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quotes or clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
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

          {/* Quotes List */}
          <div className="space-y-4">
            {filteredQuotes.map((quote) => (
              <Card 
                key={quote.id} 
                className="brand-card cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleQuoteClick(quote.id)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="brand-heading-3">Quote {quote.quote_number}</CardTitle>
                      <CardDescription className="brand-body">
                        For <button 
                          className="text-brand-teal hover:text-brand-teal-dark underline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClientClick(quote.client.id);
                          }}
                        >
                          {quote.client?.full_name}
                        </button> • {quote.client?.email}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <BrandBadge status={quote.status as 'sent' | 'accepted' | 'declined' | 'pending'}>
                        {quote.status === 'sent' ? 'Pending' : 
                         quote.status === 'declined' ? 'Rejected' :
                         quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                      </BrandBadge>
                      <Button variant="outline" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        handleQuoteClick(quote.id);
                      }}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" onClick={(e) => handleEditQuote(quote.id, e)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={(e) => handleDeleteQuote(quote.id, e)}>
                        <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <span className="brand-body">Total: {formatCurrency(quote.total_cost)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="brand-body">Created: {new Date(quote.created_at).toLocaleDateString()}</span>
                    </div>
                    {quote.expires_at && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="brand-body">Expires: {new Date(quote.expires_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

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
