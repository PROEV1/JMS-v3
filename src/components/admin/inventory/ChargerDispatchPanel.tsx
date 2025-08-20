
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, Calendar, User, MapPin, Truck, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface ChargerDispatch {
  id: string;
  order_id: string;
  item_id: string;
  qty: number;
  method: string;
  status: string;
  tracking_number: string | null;
  fulfilment_partner: string | null;
  external_id: string | null;
  notes: string | null;
  created_at: string;
  orders: {
    order_number: string;
    scheduled_install_date: string | null;
    client_id: string;
    engineer_id: string | null;
    clients: {
      full_name: string;
      postcode: string | null;
    };
    engineers: {
      name: string;
    } | null;
  };
  inventory_items: {
    name: string;
    sku: string;
  };
}

export function ChargerDispatchPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = React.useState({
    status: 'all',
    method: 'all',
    search: ''
  });

  // Fetch charger dispatches with related data
  const { data: dispatches = [], isLoading } = useQuery({
    queryKey: ['charger-dispatches', filters],
    queryFn: async () => {
      let query = supabase
        .from('charger_dispatches')
        .select(`
          *,
          orders!inner(
            order_number,
            scheduled_install_date,
            client_id,
            engineer_id,
            clients!inner(full_name, postcode),
            engineers(name)
          ),
          inventory_items!inner(name, sku)
        `)
        .order('created_at', { ascending: false });

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      if (filters.method !== 'all') {
        query = query.eq('method', filters.method);
      }

      if (filters.search) {
        query = query.or(`orders.order_number.ilike.%${filters.search}%,orders.clients.full_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ChargerDispatch[];
    }
  });

  // Update dispatch status
  const updateDispatchMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { data, error } = await supabase
        .from('charger_dispatches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['charger-dispatches'] });
      toast({
        title: "Success",
        description: "Dispatch updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update dispatch",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_required': return 'bg-gray-100 text-gray-800';
      case 'not_sent': return 'bg-red-100 text-red-800';
      case 'pending_dispatch': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'returned': return 'bg-orange-100 text-orange-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'to_van': return 'bg-green-100 text-green-800';
      case 'direct_to_consumer': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatMethod = (method: string) => {
    return method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading dispatches...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Charger Dispatch Management</h3>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Order number, client name..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="not_required">Not Required</SelectItem>
                  <SelectItem value="not_sent">Not Sent</SelectItem>
                  <SelectItem value="pending_dispatch">Pending Dispatch</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={filters.method} onValueChange={(value) => setFilters(prev => ({ ...prev, method: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="to_van">To Van</SelectItem>
                  <SelectItem value="direct_to_consumer">Direct to Consumer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => setFilters({ status: 'all', method: 'all', search: '' })}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dispatches List */}
      <div className="grid gap-4">
        {dispatches.map((dispatch) => (
          <Card key={dispatch.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Package className="w-4 h-4" />
                    <span className="font-medium">{dispatch.orders.order_number}</span>
                    {dispatch.external_id && (
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {dispatch.inventory_items.name} ({dispatch.inventory_items.sku}) × {dispatch.qty}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Badge className={getStatusColor(dispatch.status)}>
                    {formatStatus(dispatch.status)}
                  </Badge>
                  <Badge className={getMethodColor(dispatch.method)}>
                    {formatMethod(dispatch.method)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{dispatch.orders.clients.full_name}</span>
                  </div>
                  {dispatch.orders.clients.postcode && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{dispatch.orders.clients.postcode}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {dispatch.orders.scheduled_install_date && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{format(new Date(dispatch.orders.scheduled_install_date), 'dd/MM/yyyy')}</span>
                    </div>
                  )}
                  {dispatch.orders.engineers && (
                    <div className="flex items-center space-x-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <span>{dispatch.orders.engineers.name}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {dispatch.tracking_number && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Tracking: </span>
                      <span className="font-mono">{dispatch.tracking_number}</span>
                    </div>
                  )}
                  {dispatch.fulfilment_partner && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Partner: </span>
                      <span>{dispatch.fulfilment_partner}</span>
                    </div>
                  )}
                </div>
              </div>

              {dispatch.notes && (
                <div className="p-3 bg-gray-50 rounded text-sm">
                  <span className="text-muted-foreground">Notes: </span>
                  {dispatch.notes}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // TODO: Open edit dispatch modal
                  }}
                >
                  Edit
                </Button>
                
                {dispatch.status === 'not_sent' && (
                  <Button 
                    size="sm"
                    onClick={() => updateDispatchMutation.mutate({
                      id: dispatch.id,
                      updates: { status: 'pending_dispatch' }
                    })}
                    disabled={updateDispatchMutation.isPending}
                  >
                    Mark Pending
                  </Button>
                )}
                
                {dispatch.status === 'pending_dispatch' && (
                  <Button 
                    size="sm"
                    onClick={() => updateDispatchMutation.mutate({
                      id: dispatch.id,
                      updates: { status: 'sent' }
                    })}
                    disabled={updateDispatchMutation.isPending}
                  >
                    Mark Sent
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {dispatches.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No charger dispatches found matching the current filters.
        </div>
      )}
    </div>
  );
}
