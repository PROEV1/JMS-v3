import React, { useState, useEffect } from 'react';
import { useLeads, type Lead } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LeadStatusKPIs } from '@/components/LeadStatusKPIs';
import { CreateLeadModal } from '@/components/CreateLeadModal';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const AdminLeads = () => {
  console.log('AdminLeads component rendering...');
  
  const [statusFilter, setStatusFilter] = useState<Lead['status'] | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; full_name: string; email: string; phone?: string; address?: string }>>([]);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  
  console.log('Current statusFilter:', statusFilter);
  
  // Fetch all leads (unfiltered) for both display and KPI calculations
  const { leads: allLeads, loading, error, convertToClient, convertToQuote, updateLead, createLead, deleteLead, fetchLeads } = useLeads({});
  
  // Filter leads for display based on status filter
  const filteredLeads = statusFilter === 'all' ? allLeads : allLeads.filter(lead => lead.status === statusFilter);
  const { toast } = useToast();
  const [converting, setConverting] = useState<string | null>(null);
  
  console.log('Leads data:', { allLeads: allLeads.length, filteredLeads: filteredLeads.length, loading, error, filter: statusFilter });

  // Fetch clients for the create modal
  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, email, phone, address')
        .order('full_name');
      
      if (data) {
        setClients(data);
      }
    };
    
    fetchClients();
  }, []);

  // Helper function to populate missing quote_ids for existing converted leads
  const populateMissingQuoteIds = async () => {
    console.log('Checking for converted leads without quote_id...');
    const convertedLeadsWithoutQuoteId = filteredLeads.filter(lead => 
      lead.status === 'converted' && !lead.quote_id && lead.notes
    );

    for (const lead of convertedLeadsWithoutQuoteId) {
      // Extract quote number from notes (e.g., "Converted to quote #Q2025-1977")
      const quoteMatch = lead.notes?.match(/quote #(Q\d{4}-\d{4,})/);
      if (quoteMatch) {
        const quoteNumber = quoteMatch[1];
        console.log(`Found quote number ${quoteNumber} for lead ${lead.id}`);
        
        // Find the quote in the database
        const { data: quote } = await supabase
          .from('quotes')
          .select('id')
          .eq('quote_number', quoteNumber)
          .single();
          
        if (quote) {
          console.log(`Updating lead ${lead.id} with quote_id ${quote.id}`);
          await updateLead(lead.id, { quote_id: quote.id });
          toast({
            title: "Quote Link Restored",
            description: `Linked ${lead.name} to quote ${quoteNumber}`,
          });
        }
      }
    }
  };

  const handleCreateLead = async (leadData: Lead) => {
    try {
      await createLead(leadData);
      setShowCreateModal(false);
      toast({
        title: "Success",
        description: "Lead created successfully",
      });
      // Refresh to ensure KPIs update
      await fetchLeads();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create lead",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      setDeletingLeadId(leadId);
      await deleteLead(leadId);
      toast({
        title: "Success",
        description: "Lead deleted successfully",
      });
      // Refresh to ensure KPIs update
      await fetchLeads();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete lead",
        variant: "destructive",
      });
    } finally {
      setDeletingLeadId(null);
    }
  };
  
  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Leads Management</h1>
        <div className="bg-white p-4 rounded-lg shadow">
          <p>Loading leads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Leads Management</h1>
        <div className="bg-red-100 p-4 rounded-lg">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  const handleConvertToQuote = async (lead: any) => {
    try {
      setConverting(lead.id);
      const result = await convertToQuote(lead);
      toast({
        title: "Success",
        description: `Quote ${result.quote_number} created for ${lead.name}`,
      });
      // Refresh to ensure KPIs update
      await fetchLeads();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to convert lead to quote",
        variant: "destructive",
      });
    } finally {
      setConverting(null);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    try {
      await updateLead(leadId, { status: newStatus });
      toast({
        title: "Status updated",
        description: "Lead status has been updated",
      });
      // Refresh to ensure KPIs update
      await fetchLeads();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lead status",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Leads Management</h1>
        <div className="flex items-center gap-4">
          <Button onClick={() => setShowCreateModal(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as Lead['status'] | 'all')}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leads</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="unqualified">Unqualified</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{filteredLeads.length} leads</Badge>
        </div>
      </div>
      
      {/* KPI Status Widgets */}
      <LeadStatusKPIs 
        leads={allLeads} 
        onStatusFilter={(status) => setStatusFilter(status as Lead['status'] | 'all')} 
      />
      
      <div className="space-y-4">
        {filteredLeads.map((lead) => (
          <Card key={lead.id} className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{lead.name}</CardTitle>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>ID: {lead.id.slice(0, 8)}...</span>
                    <span>•</span>
                    <span>{new Date(lead.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={
                      lead.status === 'new' ? 'default' : 
                      lead.status === 'contacted' ? 'secondary' :
                      lead.status === 'qualified' ? 'outline' : 
                      lead.status === 'converted' ? 'default' :
                      lead.status === 'unqualified' ? 'destructive' : 'destructive'
                    }
                    className={
                      lead.status === 'converted' ? 'bg-green-600 text-white hover:bg-green-700' : ''
                    }
                   >
                     {(() => {
                       if (lead.status === 'converted') return '✓ CONVERTED';
                       const statusString = String(lead.status || '').toLowerCase();
                       if (!lead.status || statusString === 'unknown') return 'NEW';
                       return lead.status.toUpperCase();
                     })()}
                   </Badge>
                  {lead.client_id && (
                    <Badge variant="outline" className="text-xs">
                      Client: {lead.client_id.slice(0, 8)}
                    </Badge>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={deletingLeadId === lead.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Lead</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this lead for "{lead.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteLead(lead.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deletingLeadId === lead.id ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <p className="font-medium">{lead.email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone</span>
                  <p className="font-medium">{lead.phone || 'N/A'}</p>
                </div>
                {lead.product_name && (
                  <div>
                    <span className="text-muted-foreground">Product</span>
                    <p className="font-medium">{lead.product_name}</p>
                  </div>
                )}
                {(lead.total_price || lead.product_price) && (
                  <div>
                    <span className="text-muted-foreground">Total Price</span>
                    <p className="font-medium">£{lead.total_price || lead.product_price}</p>
                  </div>
                )}
              </div>

              {(lead.configuration || lead.accessories_data || lead.accessories) && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Your Configuration:</h4>
                  <div className="bg-muted p-4 rounded-md space-y-3">
                    {lead.product_name && lead.product_price && (
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{lead.product_name}</span>
                        <span className="font-semibold">£{lead.product_price}</span>
                      </div>
                    )}
                    
                    {lead.configuration && Object.keys(lead.configuration).length > 0 && (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {Object.entries(lead.configuration).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-medium">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {(() => {
                      let accessoriesList = [];
                      if (lead.accessories_data) {
                        if (typeof lead.accessories_data === 'string') {
                          try {
                            accessoriesList = JSON.parse(lead.accessories_data);
                          } catch (e) {
                            console.error('Failed to parse accessories_data:', e);
                          }
                        } else if (Array.isArray(lead.accessories_data)) {
                          accessoriesList = lead.accessories_data;
                        }
                      } else if (lead.accessories) {
                        accessoriesList = lead.accessories;
                      }
                      
                      return accessoriesList && accessoriesList.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-muted-foreground">Accessories:</div>
                          {accessoriesList.map((accessory: any, index: number) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span>{accessory.name}</span>
                              <span className="text-green-600">+£{accessory.price}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    
                    {lead.configuration && (
                      <div className="space-y-1">
                        {lead.configuration.installation && (
                          <div className="flex justify-between items-center text-sm">
                            <span>{lead.configuration.installation}</span>
                            <span className="text-green-600 font-medium">Free</span>
                          </div>
                        )}
                        {lead.configuration.stud_wall_removal && (
                          <div className="flex justify-between items-center text-sm">
                            <span>Stud Wall Removal</span>
                            <span className="text-green-600 font-medium">Free</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {lead.total_price && (
                      <div className="border-t pt-2 mt-3">
                        <div className="flex justify-between items-center font-semibold text-lg">
                          <span>Total Price</span>
                          <span>£{lead.total_price}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {lead.notes && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Notes:</h4>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm">{lead.notes}</p>
                  </div>
                </div>
              )}

              {lead.product_details && !lead.product_name && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Selected Products:</h4>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm">{lead.product_details}</p>
                  </div>
                </div>
              )}

              {lead.message && !lead.notes && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Customer Message:</h4>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm">{lead.message}</p>
                  </div>
                </div>
              )}

              {lead.total_cost && !lead.product_price && (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-md">
                  <span className="text-sm font-medium">Estimated Cost:</span>
                  <span className="text-lg font-bold text-green-700">
                    £{typeof lead.total_cost === 'number' ? lead.total_cost.toLocaleString() : lead.total_cost}
                  </span>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={lead.status === 'contacted' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange(lead.id, 'contacted')}
                  >
                    Contacted
                  </Button>
                  <Button
                    variant={lead.status === 'qualified' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange(lead.id, 'qualified')}
                  >
                    Qualified
                  </Button>
                  <Button
                    variant={lead.status === 'unqualified' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange(lead.id, 'unqualified')}
                    className={lead.status === 'unqualified' ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600 border-red-200 hover:bg-red-50'}
                  >
                    Unqualified
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  {/* Debug: Show quote_id status */}
                  {lead.status === 'converted' && (
                    <span className="text-xs text-gray-500">
                      Quote ID: {lead.quote_id || 'Missing'}
                    </span>
                  )}
                  {lead.status === 'converted' && !lead.quote_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={populateMissingQuoteIds}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Fix Quote Link
                    </Button>
                  )}
                  {lead.status === 'converted' && lead.quote_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/admin/quotes/${lead.quote_id}`}
                    >
                      View Quote
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleConvertToQuote(lead)}
                    disabled={converting === lead.id || lead.status === 'converted' || !lead.client_id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {converting === lead.id ? 'Converting...' : 
                     lead.status === 'converted' ? 'Converted' : 'Convert to Quote'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

          <CreateLeadModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateLead}
          />
    </div>
  );
};

export default AdminLeads;
