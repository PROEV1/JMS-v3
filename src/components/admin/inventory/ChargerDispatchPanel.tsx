
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Package, Truck, User } from "lucide-react";

// Local interfaces to work around missing Supabase types
interface ChargerDispatch {
  id: string;
  order_id: string;
  item_id: string;
  qty: number;
  method: 'to_van' | 'direct_to_consumer';
  status: 'not_required' | 'not_sent' | 'pending_dispatch' | 'sent' | 'delivered' | 'returned' | 'cancelled';
  tracking_number?: string;
  fulfilment_partner?: string;
  external_id?: string;
  from_location_id?: string;
  to_location_id?: string;
  engineer_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  orders?: {
    order_number: string;
    scheduled_install_date?: string;
    clients?: {
      full_name: string;
    };
  };
  inventory_items?: {
    name: string;
    sku: string;
  };
  engineers?: {
    name: string;
  };
}

interface ChargerDispatchPanelProps {
  onSwitchTab: (tab: string) => void;
}

export function ChargerDispatchPanel({ onSwitchTab }: ChargerDispatchPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [editingDispatch, setEditingDispatch] = React.useState<ChargerDispatch | null>(null);

  const { data: dispatches = [] } = useQuery({
    queryKey: ['charger-dispatches', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('charger_dispatches' as any)
        .select(`
          *,
          orders!inner (
            order_number,
            scheduled_install_date,
            clients (
              full_name
            )
          ),
          inventory_items (
            name,
            sku
          ),
          engineers (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ChargerDispatch[];
    }
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['scheduled-orders-for-dispatch'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders' as any)
        .select(`
          id,
          order_number,
          scheduled_install_date,
          clients (
            full_name
          )
        `)
        .not('scheduled_install_date', 'is', null)
        .order('scheduled_install_date');

      if (error) throw error;
      return data;
    }
  });

  const updateDispatchMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<ChargerDispatch> }) => {
      const { data, error } = await supabase
        .from('charger_dispatches' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Dispatch updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["charger-dispatches"] });
      setEditingDispatch(null);
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

  const getMethodIcon = (method: string) => {
    return method === 'to_van' ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Charger Dispatch</h2>
          <p className="text-muted-foreground">
            Manage charger dispatches for scheduled installations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dispatches</SelectItem>
              <SelectItem value="not_sent">Not Sent</SelectItem>
              <SelectItem value="pending_dispatch">Pending Dispatch</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4">
        {dispatches.map((dispatch) => (
          <Card key={dispatch.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-base">
                      {dispatch.orders?.order_number}
                    </CardTitle>
                    <Badge className={getStatusColor(dispatch.status)}>
                      {dispatch.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {dispatch.orders?.clients?.full_name}
                  </p>
                  {dispatch.orders?.scheduled_install_date && (
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(dispatch.orders.scheduled_install_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {getMethodIcon(dispatch.method)}
                  <span className="text-sm">
                    {dispatch.method === 'to_van' ? 'To Van' : 'Direct'}
                  </span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Item: </span>
                  <span>{dispatch.inventory_items?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">SKU: </span>
                  <span>{dispatch.inventory_items?.sku}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Quantity: </span>
                  <span>{dispatch.qty}</span>
                </div>
                {dispatch.engineers && (
                  <div>
                    <span className="text-muted-foreground">Engineer: </span>
                    <span>{dispatch.engineers.name}</span>
                  </div>
                )}
              </div>

              {dispatch.tracking_number && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Tracking: </span>
                  <span className="font-mono">{dispatch.tracking_number}</span>
                </div>
              )}

              {dispatch.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Notes: </span>
                  <span>{dispatch.notes}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingDispatch(dispatch)}
                >
                  Update Status
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {dispatches.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No charger dispatches found.
        </div>
      )}

      {/* Quick Status Update Modal */}
      {editingDispatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Update Dispatch Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select 
                  value={editingDispatch.status} 
                  onValueChange={(value) => setEditingDispatch(prev => 
                    prev ? { ...prev, status: value as any } : null
                  )}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_sent">Not Sent</SelectItem>
                    <SelectItem value="pending_dispatch">Pending Dispatch</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tracking Number</Label>
                <Input
                  value={editingDispatch.tracking_number || ''}
                  onChange={(e) => setEditingDispatch(prev => 
                    prev ? { ...prev, tracking_number: e.target.value } : null
                  )}
                  placeholder="Enter tracking number"
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editingDispatch.notes || ''}
                  onChange={(e) => setEditingDispatch(prev => 
                    prev ? { ...prev, notes: e.target.value } : null
                  )}
                  placeholder="Add notes..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setEditingDispatch(null)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => updateDispatchMutation.mutate({
                    id: editingDispatch.id,
                    updates: {
                      status: editingDispatch.status,
                      tracking_number: editingDispatch.tracking_number,
                      notes: editingDispatch.notes
                    }
                  })}
                  disabled={updateDispatchMutation.isPending}
                >
                  {updateDispatchMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
