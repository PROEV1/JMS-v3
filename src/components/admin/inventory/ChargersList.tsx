import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Truck, Warehouse, Package, Eye, MapPin, User } from "lucide-react";
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';
import { ChargerDispatchPanel } from './ChargerDispatchPanel';

interface ChargerItem {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  is_active: boolean;
  on_hand?: number;
  engineer_assignments?: {
    engineer_id: string;
    engineer_name: string;
    location_id: string;
    location_name: string;
    stock_count: number;
  }[];
  dispatch_status?: {
    pending: number;
    sent: number;
    delivered: number;
  };
}

interface ChargersListProps {
  onSwitchTab: (tab: string) => void;
}

export function ChargersList({ onSwitchTab }: ChargersListProps) {
  const [showDispatchPanel, setShowDispatchPanel] = useState(false);
  
  const { data: chargerItems = [], isLoading } = useQuery({
    queryKey: ['charger-items'],
    queryFn: async () => {
      // Fetch charger items
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_charger', true)
        .eq('is_active', true)
        .order('name');

      if (itemsError) throw itemsError;

      // Get stock levels and engineer assignments
      const chargerData = await Promise.all(
        items.map(async (item) => {
          // For simplicity, we'll use placeholder stock data
          // In a real implementation, you'd need proper stock calculation
          const totalStock = 5; // Placeholder

          // Get engineer assignments (van locations)
          const { data: vanLocations } = await supabase
            .from('inventory_locations')
            .select(`
              id,
              name,
              engineer_id,
              engineers (
                name
              )
            `)
            .eq('type', 'van')
            .eq('is_active', true);

          // Create mock engineer assignments for demo
          const engineerAssignments = (vanLocations || [])
            .filter(location => location.engineer_id)
            .map((location) => ({
              engineer_id: location.engineer_id,
              engineer_name: location.engineers?.name || 'Unassigned',
              location_id: location.id,
              location_name: location.name,
              stock_count: Math.floor(Math.random() * 3) // Random stock for demo
            }));

          // Get dispatch status counts
          const { data: dispatches } = await supabase
            .from('charger_dispatches')
            .select('status')
            .eq('charger_item_id', item.id);

          const dispatchStatus = {
            pending: dispatches?.filter(d => d.status === 'pending_dispatch').length || 0,
            sent: dispatches?.filter(d => d.status === 'sent').length || 0,
            delivered: dispatches?.filter(d => d.status === 'delivered').length || 0,
          };

          return {
            ...item,
            on_hand: totalStock,
            engineer_assignments: engineerAssignments,
            dispatch_status: dispatchStatus
          } as ChargerItem;
        })
      );

      return chargerData;
    }
  });

  // Calculate metrics
  const { data: metrics } = useQuery({
    queryKey: ['charger-metrics', chargerItems],
    queryFn: async () => {
      if (!chargerItems.length) return null;

      const totalChargers = chargerItems.length;
      const totalStock = chargerItems.reduce((sum, item) => sum + (item.on_hand || 0), 0);
      const engineersWithChargers = new Set(
        chargerItems.flatMap(item => 
          item.engineer_assignments?.filter(a => a.stock_count > 0).map(a => a.engineer_id) || []
        )
      ).size;

      const totalDispatchesPending = chargerItems.reduce((sum, item) => 
        sum + (item.dispatch_status?.pending || 0), 0
      );

      return {
        totalChargers,
        totalStock,
        engineersWithChargers,
        totalDispatchesPending
      };
    },
    enabled: chargerItems.length > 0
  });

  if (showDispatchPanel) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setShowDispatchPanel(false)}
          >
            ← Back to Chargers
          </Button>
        </div>
        <ChargerDispatchPanel onSwitchTab={onSwitchTab} />
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading chargers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Charger Management</h2>
          <p className="text-muted-foreground">
            Manage charger inventory, engineer assignments, and dispatches
          </p>
        </div>
        <Button onClick={() => setShowDispatchPanel(true)} className="flex items-center gap-2">
          <Package className="w-4 h-4" />
          View Dispatches
        </Button>
      </div>

      {/* Header Metrics */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <InventoryKpiTile
            title="Charger Models"
            value={metrics.totalChargers}
            icon={Zap}
            variant="info"
            subtitle="Active charger types"
          />
          <InventoryKpiTile
            title="Total Stock"
            value={metrics.totalStock}
            icon={Package}
            variant="success"
            subtitle="Units available"
          />
          <InventoryKpiTile
            title="Engineers with Stock"
            value={metrics.engineersWithChargers}
            icon={User}
            variant="neutral"
            subtitle="Van inventories"
          />
          <InventoryKpiTile
            title="Pending Dispatches"
            value={metrics.totalDispatchesPending}
            icon={Truck}
            variant="warning"
            subtitle="Awaiting dispatch"
          />
        </div>
      )}

      <div className="grid gap-6">
        {chargerItems.map((charger) => (
          <Card key={charger.id} className="relative">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{charger.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">SKU: {charger.sku}</p>
                    {charger.description && (
                      <p className="text-sm text-muted-foreground mt-1">{charger.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                <StatusChip status="active">
                  {charger.on_hand || 0} in stock
                </StatusChip>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Engineer Assignments */}
              {charger.engineer_assignments && charger.engineer_assignments.length > 0 ? (
                <div>
                  <h4 className="font-medium mb-2">Engineer Van Stock</h4>
                  <div className="grid gap-2">
                    {charger.engineer_assignments.map((assignment) => (
                      <div 
                        key={`${assignment.engineer_id}-${assignment.location_id}`}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{assignment.engineer_name}</span>
                          <span className="text-xs text-muted-foreground">({assignment.location_name})</span>
                        </div>
                        <Badge variant={assignment.stock_count > 0 ? "default" : "secondary"}>
                          {assignment.stock_count} units
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No engineer assignments</p>
                </div>
              )}

              {/* Dispatch Status */}
              {charger.dispatch_status && (
                <div>
                  <h4 className="font-medium mb-2">Dispatch Status</h4>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span>{charger.dispatch_status.pending} Pending</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>{charger.dispatch_status.sent} Sent</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>{charger.dispatch_status.delivered} Delivered</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onSwitchTab('items')}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onSwitchTab('locations')}
                  >
                    <MapPin className="w-4 h-4 mr-1" />
                    View Locations
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowDispatchPanel(true)}
                >
                  <Truck className="w-4 h-4 mr-1" />
                  Manage Dispatches
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {chargerItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Chargers Found</h3>
          <p className="mb-4">No charger items are currently configured in the inventory.</p>
          <Button onClick={() => onSwitchTab('items')}>
            Add Charger Items
          </Button>
        </div>
      )}
    </div>
  );
}