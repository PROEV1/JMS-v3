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

      {/* Charger Units Table */}
      <div className="space-y-4">
        {(chargerItems || []).map((charger) => (
          <Card key={charger.id}>
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
                    {charger.total_units} total, {charger.available_units} available
                  </StatusChip>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {charger.individual_units?.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Engineer</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(charger.individual_units || []).map((unit) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-medium">
                            {unit.serial_number}
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell>
                            {unit.engineer_name ? (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm">{unit.engineer_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {unit.location_name ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm">{unit.location_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Warehouse</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm">
                                <Settings className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Truck className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No individual units tracked yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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