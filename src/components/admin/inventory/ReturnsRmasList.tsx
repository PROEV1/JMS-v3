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
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';
import { EmptyState } from './shared/EmptyState';

export function ReturnsRmasList() {
  const [searchQuery, setSearchQuery] = useState('');

  // Header metrics
  const { data: metrics } = useQuery({
    queryKey: ['rma-metrics'],
    queryFn: async () => {
      // Placeholder data - would normally come from returns_rmas table
      return {
        openRMAs: 3,
        inTransitToSupplier: 1,
        waitingReplacement: 2
      };
    }
  });

  // Returns & RMAs list
  const { data: returns } = useQuery({
    queryKey: ['returns-rmas', searchQuery],
    queryFn: async () => {
      // Placeholder data - would normally query returns_rmas table
      return [
        {
          id: '1',
          serial_number: 'CHG-001-2024',
          item: { name: 'EV Charger Type 2', sku: 'CHG-T2-001' },
          status: 'pending_return',
          opened_on: '2024-01-10',
          supplier: { name: 'ChargePoint Ltd' },
          return_reason: 'Defective unit - not charging',
          replacement_serial: null
        },
        {
          id: '2',
          serial_number: 'CBL-002-2024',
          item: { name: 'Charging Cable 32A', sku: 'CBL-32A-002' },
          status: 'replacement_received',
          opened_on: '2024-01-08',
          supplier: { name: 'TechSupply Ltd' },
          return_reason: 'Customer damaged',
          replacement_serial: 'CBL-003-2024'
        }
      ];
    }
  });

  const filteredReturns = returns?.filter(rma => 
    rma.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rma.item.name.toLowerCase().includes(searchQuery.toLowerCase())
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
        
        <Button>
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
                      <span className="font-medium">{rma.serial_number}</span>
                      <StatusChip status={getStatusVariant(rma.status) as any}>
                        {rma.status.replace('_', ' ')}
                      </StatusChip>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {rma.item.name} ({rma.item.sku})
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Supplier: {rma.supplier.name} • Opened: {rma.opened_on}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Reason: {rma.return_reason}
                    </div>
                    {rma.replacement_serial && (
                      <div className="text-xs text-green-600">
                        Replacement: {rma.replacement_serial}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-1" />
                      Update
                    </Button>
                    {rma.status === 'pending_return' && (
                      <Button variant="outline" size="sm">
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
              onAction={() => {/* TODO: Open create RMA modal */}}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}