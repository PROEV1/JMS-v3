import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Plus, 
  Eye, 
  Edit, 
  Package, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Filter,
  CalendarDays
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { ViewPurchaseOrderModal } from './ViewPurchaseOrderModal';
import { EditPurchaseOrderModal } from './EditPurchaseOrderModal';
import { ReceivePurchaseOrderModal } from './ReceivePurchaseOrderModal';
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { EnhancedJobStatusBadge, type OrderStatusEnhanced } from '../EnhancedJobStatusBadge';
import { EmptyState } from './shared/EmptyState';

export function PurchaseOrdersList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [engineerFilter, setEngineerFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);

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

  // Get unique engineers for filter
  const { data: engineers } = useQuery({
    queryKey: ['engineers-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Purchase orders list
  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchase-orders', searchQuery, sortOrder, engineerFilter, dateFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, po_number, status, order_date, expected_delivery_date, total_amount, notes, created_at,
          supplier_id, created_by, engineer_id,
          engineers!purchase_orders_engineer_id_fkey(id, name),
          inventory_suppliers(id, name)
        `)
        .order('created_at', { ascending: sortOrder === 'oldest' });

      if (error) {
        console.error('Error fetching purchase orders:', error);
        throw error;
      }

      console.log('Purchase orders data:', data);
      return data || [];
    }
  });

  const filteredPOs = purchaseOrders?.filter(po => {
    // Search filter
    const matchesSearch = po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.inventory_suppliers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.engineers?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Engineer filter
    const matchesEngineer = engineerFilter === 'all' || 
      (engineerFilter === 'unassigned' && !po.engineer_id) ||
      po.engineer_id === engineerFilter;
    
    // Date filter
    const matchesDate = (() => {
      if (dateFilter === 'all') return true;
      
      const poDate = new Date(po.created_at);
      const now = new Date();
      
      switch (dateFilter) {
        case 'today':
          return poDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return poDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return poDate >= monthAgo;
        case 'overdue':
          return po.expected_delivery_date && 
            new Date(po.expected_delivery_date) < now && 
            po.status !== 'received';
        default:
          return true;
      }
    })();
    
    return matchesSearch && matchesEngineer && matchesDate;
  }) || [];

  const getStatusForBadge = (status: string): OrderStatusEnhanced => {
    switch (status) {
      case 'pending': return 'awaiting_payment';
      case 'approved': return 'payment_received';
      case 'received': return 'completed';
      case 'cancelled': return 'revisit_required';
      default: return 'awaiting_payment';
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
              placeholder="Search POs, suppliers, engineers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-80"
            />
          </div>
          
          {/* Sort Order Filter */}
          <Select value={sortOrder} onValueChange={(value: 'latest' | 'oldest') => setSortOrder(value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="z-[100] max-h-96 overflow-auto">
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Engineer Filter */}
          <Select value={engineerFilter} onValueChange={setEngineerFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Engineer" />
            </SelectTrigger>
            <SelectContent className="z-[100] max-h-96 overflow-auto">
              <SelectItem value="all">All Engineers</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {engineers?.map((engineer) => (
                <SelectItem key={engineer.id} value={engineer.id}>
                  {engineer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-36">
              <CalendarDays className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent className="z-[100] max-h-96 overflow-auto">
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
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
                      <EnhancedJobStatusBadge 
                        status={getStatusForBadge(po.status)}
                        className="text-xs"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {po.inventory_suppliers?.name || 'Unknown Supplier'} • £{po.total_amount?.toFixed(2) || '0.00'}
                      {po.engineers && (
                        <span> • <span className="text-blue-600 font-medium">{po.engineers.name}</span></span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ETA: {po.expected_delivery_date || 'TBD'} • Created: {new Date(po.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedPOId(po.id);
                        setShowViewModal(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedPOId(po.id);
                        setShowEditModal(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {(po.status === 'pending' || po.status === 'approved') && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedPOId(po.id);
                          setShowReceiveModal(true);
                        }}
                      >
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
      
      <ViewPurchaseOrderModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        purchaseOrderId={selectedPOId}
      />
      
      <EditPurchaseOrderModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        purchaseOrderId={selectedPOId}
      />
      
      <ReceivePurchaseOrderModal
        open={showReceiveModal}
        onOpenChange={setShowReceiveModal}
        purchaseOrderId={selectedPOId}
      />
    </div>
  );
}