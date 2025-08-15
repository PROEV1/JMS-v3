import React, { useState } from 'react';
import { useLeads, type Lead } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LeadStatusKPIs } from '@/components/LeadStatusKPIs';

const AdminLeads = () => {
  console.log('AdminLeads component rendering...');
  
  const [statusFilter, setStatusFilter] = useState<Lead['status'] | 'all'>('all');
  console.log('Current statusFilter:', statusFilter);
  
  const { leads, loading, error, convertToClient, updateLead } = useLeads({
    status: statusFilter === 'all' ? undefined : statusFilter
  });
  
  // Fetch all leads for KPI calculations (unfiltered)
  const { leads: allLeads } = useLeads({});
  const { toast } = useToast();
  const [converting, setConverting] = useState<string | null>(null);
  
  console.log('Leads data:', { leads: leads.length, loading, error, filter: statusFilter });
  
  try {
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

    const handleConvertToClient = async (lead: any) => {
      try {
        setConverting(lead.id);
        await convertToClient(lead);
        toast({
          title: "Success",
          description: `${lead.name} has been converted to a client`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to convert lead to client",
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
            <Badge variant="secondary">{leads.length} leads</Badge>
          </div>
        </div>
        
        {/* KPI Status Widgets */}
        <LeadStatusKPIs 
          leads={allLeads} 
          onStatusFilter={(status) => setStatusFilter(status as Lead['status'] | 'all')} 
        />
        
        <div className="space-y-4">
          {leads.map((lead) => (
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
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-3">
                {/* Lead Details Grid */}
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
                  {lead.width_cm && (
                    <div>
                      <span className="text-muted-foreground">Width</span>
                      <p className="font-medium">{lead.width_cm}cm</p>
                    </div>
                  )}
                </div>

                {/* Pricing Breakdown */}
                {(lead.configuration || lead.accessories_data || lead.accessories) && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Your Configuration:</h4>
                    <div className="bg-muted p-4 rounded-md space-y-3">
                      {/* Main Product */}
                      {lead.product_name && lead.product_price && (
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{lead.product_name}</span>
                          <span className="font-semibold">£{lead.product_price}</span>
                        </div>
                      )}
                      
                      {/* Configuration Details */}
                      {lead.configuration && (
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {lead.configuration.width && (
                            <div><span className="font-medium">Width:</span> {lead.configuration.width}</div>
                          )}
                          {lead.configuration.finish && (
                            <div><span className="font-medium">Finish:</span> {lead.configuration.finish}</div>
                          )}
                          {lead.configuration.luxe_upgrade !== undefined && (
                            <div><span className="font-medium">Luxe Upgrade:</span> {lead.configuration.luxe_upgrade ? 'Yes' : 'No'}</div>
                          )}
                        </div>
                      )}
                      
                      {/* Accessories */}
                      {(() => {
                        // Parse accessories from either accessories_data (JSONB) or accessories array
                        let accessoriesList = [];
                        if (lead.accessories_data) {
                          // Handle JSONB data from database
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
                      
                      {/* Free Services */}
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
                      
                      {/* Total */}
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

                {/* Notes */}
                {lead.notes && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Notes:</h4>
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm">{lead.notes}</p>
                    </div>
                  </div>
                )}

                {/* Product Details (fallback for existing data) */}
                {lead.product_details && !lead.product_name && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Selected Products:</h4>
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm">{lead.product_details}</p>
                    </div>
                  </div>
                )}

                {/* Customer Message (fallback for existing data) */}
                {lead.message && !lead.notes && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Customer Message:</h4>
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm">{lead.message}</p>
                    </div>
                  </div>
                )}

                {/* Cost Information (fallback for existing data) */}
                {lead.total_cost && !lead.product_price && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-md">
                    <span className="text-sm font-medium">Estimated Cost:</span>
                    <span className="text-lg font-bold text-green-700">
                      £{typeof lead.total_cost === 'number' ? lead.total_cost.toLocaleString() : lead.total_cost}
                    </span>
                  </div>
                )}

                <Separator />

                {/* Action Buttons */}
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
                    {lead.status === 'converted' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/admin/clients/${lead.client_id || 'd2a0426a-ec18-4d42-b65a-fd27ba167f7f'}`}
                      >
                        View Client Record
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleConvertToClient(lead)}
                      disabled={converting === lead.id || lead.status === 'converted'}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {converting === lead.id ? 'Converting...' : 
                       lead.status === 'converted' ? 'Converted' : 'Convert to Client'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in AdminLeads:', error);
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Error in Leads</h1>
        <div className="bg-red-100 p-4 rounded-lg">
          <p>Error: {error?.toString()}</p>
        </div>
      </div>
    );
  }
};

export default AdminLeads;