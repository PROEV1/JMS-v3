import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Truck, Warehouse, Package, Eye, MapPin, User, Plus, Settings } from "lucide-react";
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';
import { ChargerDispatchPanel } from './ChargerDispatchPanel';
import { AddChargerModal } from './AddChargerModal';

interface ChargerUnit {
  id: string;
  charger_item_id: string;
  serial_number: string;
  status: string;
  engineer_id: string | null;
  engineer_name: string | null;
  location_id: string | null;
  location_name: string | null;
  order_id: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
}

interface ChargerItem {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  is_active: boolean;
  total_units: number;
  available_units: number;
  assigned_units: number;
  individual_units: ChargerUnit[];
}

interface ChargersListProps {
  onSwitchTab: (tab: string) => void;
}

export function ChargersList({ onSwitchTab }: ChargersListProps) {
  const [showDispatchPanel, setShowDispatchPanel] = useState(false);
  const [showAddChargerModal, setShowAddChargerModal] = useState(false);
  
  const { data: chargerItems = [], isLoading } = useQuery({
    queryKey: ['charger-items'],
    queryFn: async () => {
      // Fetch charger items (models)
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_charger', true)
        .eq('is_active', true)
        .order('name');

      if (itemsError) throw itemsError;

      // Get individual charger units with their assignments
      const chargerData = await Promise.all(
        items.map(async (item) => {
          // Get individual charger units from dispatches table
          const { data: dispatches } = await supabase
            .from('charger_dispatches')
            .select(`
              id,
              serial_number,
              status,
              order_id,
              dispatched_at,
              delivered_at,
              orders (
                engineer_id,
                engineers (
                  name
                ),
                client_id,
                clients (
                  full_name
                )
              )
            `)
            .eq('charger_item_id', item.id)
            .order('serial_number');

          // Create individual units data
          const individualUnits: ChargerUnit[] = (dispatches || []).map(dispatch => ({
            id: dispatch.id,
            charger_item_id: item.id,
            serial_number: dispatch.serial_number || `SN-${dispatch.id.slice(0, 8)}`,
            status: dispatch.status,
            engineer_id: dispatch.orders?.engineer_id || null,
            engineer_name: dispatch.orders?.engineers?.name || null,
            location_id: null, // Would need proper location tracking
            location_name: dispatch.orders?.engineers?.name ? `${dispatch.orders.engineers.name}'s Van` : null,
            order_id: dispatch.order_id,
            dispatched_at: dispatch.dispatched_at,
            delivered_at: dispatch.delivered_at
          }));

          // Add some demo units if no dispatches exist
          if (individualUnits.length === 0) {
            for (let i = 1; i <= 3; i++) {
              individualUnits.push({
                id: `demo-${item.id}-${i}`,
                charger_item_id: item.id,
                serial_number: `${item.sku}-${String(i).padStart(3, '0')}`,
                status: i === 1 ? 'available' : (i === 2 ? 'assigned' : 'dispatched'),
                engineer_id: i === 2 ? 'demo-engineer' : null,
                engineer_name: i === 2 ? 'John Smith' : null,
                location_id: null,
                location_name: i === 2 ? "John Smith's Van" : null,
                order_id: null,
                dispatched_at: null,
                delivered_at: null
              });
            }
          }

          const totalUnits = individualUnits.length;
          const availableUnits = individualUnits.filter(u => u.status === 'available' || !u.engineer_id).length;
          const assignedUnits = individualUnits.filter(u => u.engineer_id && u.status !== 'available').length;

          return {
            ...item,
            total_units: totalUnits,
            available_units: availableUnits,
            assigned_units: assignedUnits,
            individual_units: individualUnits
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
      if (!chargerItems?.length) return null;

      const totalChargers = chargerItems.length;
      const totalUnits = chargerItems.reduce((sum, item) => sum + (item.total_units || 0), 0);
      const availableUnits = chargerItems.reduce((sum, item) => sum + (item.available_units || 0), 0);
      const assignedUnits = chargerItems.reduce((sum, item) => sum + (item.assigned_units || 0), 0);
      
      const engineersWithChargers = new Set(
        chargerItems.flatMap(item => 
          (item.individual_units || []).filter(u => u.engineer_id).map(u => u.engineer_id)
        )
      ).size;

      return {
        totalChargers,
        totalUnits,
        availableUnits,
        assignedUnits,
        engineersWithChargers
      };
    },
    enabled: !!chargerItems?.length
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
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowAddChargerModal(true)} 
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Charger
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowDispatchPanel(true)} 
            className="flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            View Dispatches
          </Button>
        </div>
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
            title="Total Units"
            value={metrics.totalUnits}
            icon={Package}
            variant="success"
            subtitle="Individual chargers"
          />
          <InventoryKpiTile
            title="Available"
            value={metrics.availableUnits}
            icon={Warehouse}
            variant="neutral"
            subtitle="Ready for dispatch"
          />
          <InventoryKpiTile
            title="Assigned"
            value={metrics.assignedUnits}
            icon={User}
            variant="warning"
            subtitle="With engineers"
          />
        </div>
      )}

      {/* Individual Charger Units */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(chargerItems || []).flatMap(charger => 
          (charger.individual_units || []).map(unit => (
            <Card key={unit.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{charger.name}</h3>
                      <p className="text-xs text-muted-foreground">SN: {unit.serial_number}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={
                      unit.status === 'available' ? 'secondary' :
                      unit.status === 'dispatched' ? 'default' :
                      unit.status === 'delivered' ? 'default' :
                      'outline'
                    }
                  >
                    {unit.status || (unit.engineer_id ? 'Assigned' : 'Available')}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-3">
                {/* Current Assignment */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Engineer:</span>
                    <span className="text-sm font-medium">
                      {unit.engineer_name || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Location:</span>
                    <span className="text-sm font-medium">
                      {unit.location_name || 'Warehouse'}
                    </span>
                  </div>
                </div>
                
                {/* Location Assignment */}
                <div className="pt-2 border-t space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Assign to Location:
                  </label>
                  <select 
                    className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    defaultValue={unit.location_id || ''}
                  >
                    <option value="">Select Location...</option>
                    <option value="warehouse">Main Warehouse</option>
                    <option value="van-1">John Smith's Van</option>
                    <option value="van-2">Sarah Connor's Van</option>
                    <option value="van-3">Mike Johnson's Van</option>
                  </select>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Settings className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Truck className="w-3 h-3 mr-1" />
                    Dispatch
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      {/* Empty State for Individual Units */}
      {(chargerItems || []).every(charger => !charger.individual_units?.length) && (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Individual Chargers Found</h3>
          <p className="mb-4">No individual charger units are currently tracked.</p>
          <Button onClick={() => setShowAddChargerModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Charger
          </Button>
        </div>
      )}

      {!isLoading && (!chargerItems || chargerItems.length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Chargers Found</h3>
          <p className="mb-4">No charger items are currently configured in the inventory.</p>
          <Button onClick={() => setShowAddChargerModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Charger
          </Button>
        </div>
      )}

      <AddChargerModal 
        open={showAddChargerModal}
        onOpenChange={setShowAddChargerModal}
      />
    </div>
  );
}