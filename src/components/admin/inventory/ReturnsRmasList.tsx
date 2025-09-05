import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Plus, 
  Eye, 
  Edit, 
  RotateCcw, 
  Truck, 
  Clock,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';
import { EmptyState } from './shared/EmptyState';
import { CreateRMAModal } from './CreateRMAModal';
import { RmaViewModal } from './RmaViewModal';
import { RmaUpdateModal } from './RmaUpdateModal';
import { RmaShipModal } from './RmaShipModal';

export function ReturnsRmasList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRma, setSelectedRma] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);

  // Header metrics
  const { data: metrics } = useQuery({
    queryKey: ['rma-metrics'],
    queryFn: async () => {
      const { data: rmaData } = await supabase
        .from('returns_rmas')
        .select('id, status');

      const openRMAs = rmaData?.filter(rma => 
        rma.status !== 'closed' && rma.status !== 'cancelled'
      ).length || 0;
      const inTransitToSupplier = rmaData?.filter(rma => 
        rma.status === 'in_transit'
      ).length || 0;
      const waitingReplacement = rmaData?.filter(rma => 
        rma.status === 'replacement_sent'
      ).length || 0;

      return { openRMAs, inTransitToSupplier, waitingReplacement };
    }
  });

  // Returns & RMAs list
  const { data: returns } = useQuery({
    queryKey: ['returns-rmas', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('returns_rmas')
        .select(`
          id, rma_number, serial_number, status, return_reason, return_date, 
          replacement_serial_number, created_at,
          inventory_items(name, sku),
          inventory_suppliers(name),
          returns_rma_lines(quantity, condition_notes)
        `)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(`rma_number.ilike.%${searchQuery}%,serial_number.ilike.%${searchQuery}%,inventory_items.name.ilike.%${searchQuery}%`);
      }

      const { data } = await query;
      return data || [];
    }
  });

  const filteredReturns = returns?.filter(rma => 
    rma.rma_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rma.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rma.inventory_items?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending_return': return 'pending';
      case 'in_transit': return 'in_transit';
      case 'replacement_received': return 'delivered';
      case 'closed': return 'delivered';
      default: return 'pending';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'received_by_supplier': return 'RECEIVED';
      default: return status.replace('_', ' ').toUpperCase();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Returns & RMAs</h2>
        <p className="text-muted-foreground">
          Manage product returns and warranty replacements
        </p>
      </div>

      {/* Header Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <InventoryKpiTile
          title="Open RMAs"
          value={metrics?.openRMAs || 0}
          icon={RotateCcw}
          variant="warning"
          subtitle="Pending action"
        />
        
        <InventoryKpiTile
          title="In Transit to Supplier"
          value={metrics?.inTransitToSupplier || 0}
          icon={Truck}
          variant="info"
          subtitle="Being processed"
        />
        
        <InventoryKpiTile
          title="Waiting Replacement"
          value={metrics?.waitingReplacement || 0}
          icon={Clock}
          variant="warning"
          subtitle="Awaiting new units"
        />
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search returns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
        
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Return/RMA
        </Button>
      </div>

      {/* Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Returns & RMAs</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReturns.length > 0 ? (
            <div className="space-y-4">
              {filteredReturns.map((rma) => (
                <div key={rma.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{rma.rma_number}</span>
                      <StatusChip status={getStatusVariant(rma.status) as any}>
                        {getStatusText(rma.status)}
                      </StatusChip>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {rma.inventory_items?.name} ({rma.inventory_items?.sku})
                      {rma.returns_rma_lines && rma.returns_rma_lines.length > 0 && (
                        <span className="ml-2 font-medium">
                          • Qty: {rma.returns_rma_lines.reduce((total: number, line: any) => total + line.quantity, 0)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Serial: {rma.serial_number || 'N/A'} • Supplier: {rma.inventory_suppliers?.name || 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Opened: {new Date(rma.created_at).toLocaleDateString()} • Reason: {rma.return_reason}
                    </div>
                    {rma.replacement_serial_number && (
                      <div className="text-xs text-green-600">
                        Replacement: {rma.replacement_serial_number}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedRma(rma);
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
                        setSelectedRma(rma);
                        setShowUpdateModal(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Update
                    </Button>
                    {rma.status === 'pending_return' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedRma(rma);
                          setShowShipModal(true);
                        }}
                      >
                        <Truck className="h-4 w-4 mr-1" />
                        Ship Return
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={RotateCcw}
              title="No Returns or RMAs"
              description="Track product returns and warranty replacements when they occur"
              actionLabel="Create Return/RMA"
              onAction={() => setShowCreateModal(true)}
            />
          )}
        </CardContent>
      </Card>

      <CreateRMAModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal} 
      />

      <RmaViewModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        rma={selectedRma}
      />

      <RmaUpdateModal
        open={showUpdateModal}
        onOpenChange={setShowUpdateModal}
        rma={selectedRma}
      />

      <RmaShipModal
        open={showShipModal}
        onOpenChange={setShowShipModal}
        rma={selectedRma}
      />
    </div>
  );
}