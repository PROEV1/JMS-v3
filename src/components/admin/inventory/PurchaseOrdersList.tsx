import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Plus, 
  Eye, 
  Edit, 
  Package, 
  Clock, 
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';
import { EmptyState } from './shared/EmptyState';

export function PurchaseOrdersList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Header metrics
  const { data: metrics } = useQuery({
    queryKey: ['po-metrics'],
    queryFn: async () => {
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('id, status, expected_delivery_date, created_at');

      const openPOs = poData?.filter(po => po.status !== 'received' && po.status !== 'cancelled').length || 0;
      const dueThisWeek = poData?.filter(po => {
        if (!po.expected_delivery_date) return false;
        const dueDate = new Date(po.expected_delivery_date);
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return dueDate >= now && dueDate <= weekFromNow;
      }).length || 0;
      const overdue = poData?.filter(po => {
        if (!po.expected_delivery_date) return false;
        return new Date(po.expected_delivery_date) < new Date() && po.status !== 'received';
      }).length || 0;
      const receivedThisWeek = poData?.filter(po => {
        if (po.status !== 'received') return false;
        const createdDate = new Date(po.created_at);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return createdDate >= weekAgo;
      }).length || 0;

      return { openPOs, dueThisWeek, overdue, receivedThisWeek };
    }
  });

  // Purchase orders list
  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchase-orders', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(`
          id, po_number, status, order_date, expected_delivery_date, total_amount, notes, created_at,
          inventory_suppliers(name),
          profiles!purchase_orders_created_by_fkey(full_name),
          purchase_order_lines(id)
        `)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(`po_number.ilike.%${searchQuery}%,inventory_suppliers.name.ilike.%${searchQuery}%`);
      }

      const { data } = await query;
      return data || [];
    }
  });

  const filteredPOs = purchaseOrders?.filter(po => 
    po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    po.inventory_suppliers?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'pending';
      case 'approved': return 'approved';
      case 'received': return 'delivered';
      case 'cancelled': return 'cancelled';
      default: return 'pending';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Purchase Orders</h2>
        <p className="text-muted-foreground">
          Manage purchase orders and track deliveries
        </p>
      </div>

      {/* Header Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InventoryKpiTile
          title="Open POs"
          value={metrics?.openPOs || 0}
          icon={Package}
          variant="info"
          subtitle="Awaiting delivery"
        />
        
        <InventoryKpiTile
          title="Due This Week"
          value={metrics?.dueThisWeek || 0}
          icon={Clock}
          variant="warning"
          subtitle="Expected delivery"
        />
        
        <InventoryKpiTile
          title="Overdue"
          value={metrics?.overdue || 0}
          icon={AlertTriangle}
          variant="danger"
          subtitle="Past due date"
        />
        
        <InventoryKpiTile
          title="Received This Week"
          value={metrics?.receivedThisWeek || 0}
          icon={CheckCircle}
          variant="success"
          subtitle="Completed deliveries"
        />
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search POs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
        
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Purchase Order
        </Button>
      </div>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPOs.length > 0 ? (
            <div className="space-y-4">
              {filteredPOs.map((po) => (
                <div key={po.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{po.po_number}</span>
                      <StatusChip status={getStatusVariant(po.status) as any}>
                        {po.status}
                      </StatusChip>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {po.inventory_suppliers?.name || 'No supplier'} • {po.purchase_order_lines?.length || 0} items • £{po.total_amount?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ETA: {po.expected_delivery_date || 'TBD'} • Created: {new Date(po.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {po.status === 'pending' && (
                      <Button variant="outline" size="sm">
                        <Package className="h-4 w-4 mr-1" />
                        Receive
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="No Purchase Orders"
              description="Create your first purchase order to start tracking inventory replenishment"
              actionLabel="Create Purchase Order"
              onAction={() => setShowCreateModal(true)}
            />
          )}
        </CardContent>
      </Card>
      
      <CreatePurchaseOrderModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}