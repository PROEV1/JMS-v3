import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Truck, Warehouse, Package, Eye, MapPin, User, Plus, Settings, UserCheck, Search, Scan } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';
import { ChargerDispatchPanel } from './ChargerDispatchPanel';
import { AddChargerModal } from './AddChargerModal';
import { AssignChargerModal } from './AssignChargerModal';
import { EditChargerModal } from './EditChargerModal';
import { ScanChargersModal } from './ScanChargersModal';

interface ChargerUnit {
  id: string;
  charger_item_id: string;
  serial_number: string;
  status: string;
  engineer_id: string | null;
  engineer_name: string | null;
  location_id: string | null;
  location_name: string | null;
  notes: string | null;
  order_id: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  created_at?: string;
  charger_name?: string;
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDispatchPanel, setShowDispatchPanel] = useState(false);
  const [showAddChargerModal, setShowAddChargerModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCharger, setSelectedCharger] = useState<ChargerUnit | null>(null);
  const [selectedChargerModel, setSelectedChargerModel] = useState('');
  const [chargerTypeFilter, setChargerTypeFilter] = useState('all-types');
  const [statusFilter, setStatusFilter] = useState('all-statuses');
  const [serialNumberSearch, setSerialNumberSearch] = useState('');
  
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
          // Get individual charger units from charger_inventory table with order details
          const { data: inventory } = await supabase
            .from('charger_inventory')
            .select(`
              *,
              engineers (
                name
              ),
              inventory_locations (
                name
              )
            `)
            .eq('charger_item_id', item.id)
            .order('created_at', { ascending: false });

          // Get order details for chargers that have assigned_order_id
          const inventoryWithOrders = await Promise.all(
            (inventory || []).map(async (unit) => {
              if (unit.assigned_order_id) {
                const { data: orderData } = await supabase
                  .from('orders')
                  .select(`
                    job_address,
                    postcode,
                    clients (
                      address,
                      postcode
                    )
                  `)
                  .eq('id', unit.assigned_order_id)
                  .single();
                
                return { ...unit, order_details: orderData };
              }
              return unit;
            })
          );

          console.log('Inventory data for item', item.name, ':', inventory?.map(i => ({ 
            serial: i.serial_number, 
            created_at: i.created_at,
            notes: i.notes,
            location_name: i.inventory_locations?.name
          })));

          // Create individual units data
          const individualUnits: ChargerUnit[] = (inventoryWithOrders || []).map(unit => {
            // Get job address if charger is deployed on an order
            let jobAddress = null;
            if ((unit as any).order_details) {
              const order = (unit as any).order_details;
              if (order.clients) {
                const client = Array.isArray(order.clients) ? order.clients[0] : order.clients;
                jobAddress = `${client.address}, ${client.postcode}`;
              } else if (order.job_address && order.postcode) {
                jobAddress = `${order.job_address}, ${order.postcode}`;  
              }
            }

            return {
              id: unit.id,
              charger_item_id: item.id,
              serial_number: unit.serial_number || `SN-${unit.id.slice(0, 8)}`,
              status: unit.status,
              engineer_id: unit.engineer_id || null,
              engineer_name: unit.engineers?.name || null,
              location_id: unit.location_id || null,
              location_name: jobAddress || unit.inventory_locations?.name || (unit.engineer_id ? `${unit.engineers?.name}'s Van` : 'Warehouse'),
              notes: unit.notes || null,
              order_id: unit.assigned_order_id || null,
              dispatched_at: null,
              delivered_at: null,
              created_at: unit.created_at
            };
          });

          // Only include charger models that have actual inventory records
          // Don't create placeholder units - only show models with real chargers

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

      // Only return charger models that have actual inventory records
      return chargerData.filter(item => item.individual_units.length > 0);
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
            onClick={() => setShowScanModal(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Scan className="w-4 h-4" />
            Scan Chargers
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search Serial Number</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter serial number..."
                  value={serialNumberSearch}
                  onChange={(e) => setSerialNumberSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Charger Type</label>
              <Select value={chargerTypeFilter} onValueChange={setChargerTypeFilter}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All charger types" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg z-50">
                  <SelectItem value="all-types">All Charger Types</SelectItem>
                  {Array.from(new Set(chargerItems.map(charger => charger.name)))
                    .sort()
                    .map(chargerName => (
                      <SelectItem key={chargerName} value={chargerName}>
                        {chargerName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg z-50">
                  <SelectItem value="all-statuses">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chargers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Individual Charger Units
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Charger Model</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(chargerItems || [])
                .filter(charger => chargerTypeFilter === 'all-types' || charger.name === chargerTypeFilter)
                .flatMap(charger => 
                  (charger.individual_units || [])
                    .filter(unit => !serialNumberSearch || unit.serial_number.toLowerCase().includes(serialNumberSearch.toLowerCase()))
                    .filter(unit => {
                      if (statusFilter === 'all-statuses') return true;
                      if (statusFilter === 'assigned') return unit.engineer_id && unit.status !== 'available';
                      return unit.status === statusFilter || (statusFilter === 'available' && !unit.status && !unit.engineer_id);
                    })
                    .map(unit => ({ ...unit, charger_name: charger.name }))
                )
                .sort((a, b) => {
                  // Sort by creation date - newest first
                  const aDate = new Date(a.created_at || '').getTime();
                  const bDate = new Date(b.created_at || '').getTime();
                  return bDate - aDate;
                })
                .map(unit => (
                  <TableRow key={unit.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded">
                          <Zap className="w-3 h-3 text-primary" />
                        </div>
                        <span className="font-medium">{unit.charger_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {unit.serial_number}
                      </code>
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
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">
                          {unit.engineer_name || 'Unassigned'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">
                          {(() => {
                            console.log('Unit location debug:', {
                              serial: unit.serial_number,
                              notes: unit.notes,
                              location_name: unit.location_name,
                              hasJobLocation: unit.notes?.includes('Job Location:'),
                              hasVanLocation: unit.notes?.includes('Van Location:'),
                              hasLocation: unit.notes?.includes('Location:')
                            });
                            
                            if (unit.notes && (unit.notes.includes('Job Location:') || unit.notes.includes('Van Location:') || unit.notes.includes('Location:'))) {
                              return unit.notes.replace(/^.*(?:Job Location|Van Location|Location): /, '');
                            }
                            return unit.location_name || 'Warehouse';
                          })()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                         onClick={() => {
                           setSelectedCharger(unit);
                           setSelectedChargerModel(unit.charger_name || '');
                           setShowAssignModal(true);
                         }}
                        >
                          <UserCheck className="w-3 h-3 mr-1" />
                          Assign
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            console.log('Edit button clicked for charger:', unit);
                            console.log('Charger data:', { 
                              id: unit.id, 
                              serial_number: unit.serial_number,
                              status: unit.status,
                              charger_item_id: unit.charger_item_id
                            });
                            setSelectedCharger(unit);
                            setSelectedChargerModel(unit.charger_name || '');
                            setShowEditModal(true);
                          }}
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            if (unit.engineer_name) {
                              onSwitchTab('locations');
                            } else {
                              setShowDispatchPanel(true);
                            }
                          }}
                        >
                          {unit.engineer_name ? <Eye className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                        </Button>
                      </div>
                    </TableCell>
                   </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Empty State */}
      {!isLoading && (!chargerItems || chargerItems.length === 0 || chargerItems.every(charger => !charger.individual_units?.length)) && (
        <Card>
          <CardContent className="text-center py-8">
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Chargers Found</h3>
            <p className="text-muted-foreground mb-4">No charger units are currently tracked in the system.</p>
            <Button onClick={() => setShowAddChargerModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Charger
            </Button>
          </CardContent>
        </Card>
      )}

      <ScanChargersModal
        open={showScanModal}
        onOpenChange={setShowScanModal}
      />

      <AddChargerModal
        open={showAddChargerModal}
        onOpenChange={setShowAddChargerModal}
      />

      <AssignChargerModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        charger={selectedCharger}
        chargerModel={selectedChargerModel}
      />

      <EditChargerModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        charger={selectedCharger}
        chargerModel={selectedChargerModel}
      />
    </div>
  );
}