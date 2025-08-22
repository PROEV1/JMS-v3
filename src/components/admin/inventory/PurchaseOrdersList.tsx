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
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';
import { EmptyState } from './shared/EmptyState';

export function PurchaseOrdersList() {
  const [searchQuery, setSearchQuery] = useState('');

  // Header metrics
  const { data: metrics } = useQuery({
    queryKey: ['po-metrics'],
    queryFn: async () => {
      // Placeholder data - would normally come from purchase_orders table
      return {
        openPOs: 12,
        dueThisWeek: 3,
        overdue: 1,
        receivedThisWeek: 8
      };
    }
  });

  // Purchase orders list
  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchase-orders', searchQuery],
    queryFn: async () => {
      // Placeholder data - would normally query purchase_orders table
      return [
        {
          id: '1',
          po_number: 'PO-2024-001',
          supplier: { name: 'TechSupply Ltd' },
          status: 'pending',
          eta: '2024-01-15',
          line_count: 5,
          total_amount: 2450.00,
          created_by: { name: 'Admin User' },
          created_at: '2024-01-10'
        },
        {
          id: '2',
          po_number: 'PO-2024-002',
          supplier: { name: 'ElectroComponents' },
          status: 'received',
          eta: '2024-01-12',
          line_count: 3,
          total_amount: 890.50,
          created_by: { name: 'Admin User' },
          created_at: '2024-01-08'
        }
      ];
    }
  });

  const filteredPOs = purchaseOrders?.filter(po => 
    po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    po.supplier.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'pending';
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
        
        <Button>
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
                      {po.supplier.name} • {po.line_count} items • £{po.total_amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ETA: {po.eta} • Created: {po.created_at}
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
              onAction={() => {/* TODO: Open create PO modal */}}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}