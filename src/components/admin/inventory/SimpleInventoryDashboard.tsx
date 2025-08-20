
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Package, MapPin, Building, Truck } from "lucide-react";

import { InventoryItemsSimple } from "./InventoryItemsSimple";
import { LocationsList } from "./LocationsList";
import { SuppliersList } from "./SuppliersList";
import { TransactionsList } from "./TransactionsList";
import { ChargerDispatchPanel } from "./ChargerDispatchPanel";
import { AddItemModal } from "./AddItemModal";
import { AddLocationModal } from "./AddLocationModal";
import { AddSupplierModal } from "./AddSupplierModal";

export function SimpleInventoryDashboard() {
  const [addItemOpen, setAddItemOpen] = React.useState(false);
  const [addLocationOpen, setAddLocationOpen] = React.useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = React.useState(false);

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      const [itemsRes, locationsRes, chargerDispatchesRes] = await Promise.all([
        supabase.from('inventory_items').select('id, is_active', { count: 'exact' }),
        supabase.from('inventory_locations').select('id, is_active', { count: 'exact' }),
        supabase.from('charger_dispatches').select('id, status', { count: 'exact' })
      ]);

      const activeItems = itemsRes.data?.filter(item => item.is_active).length || 0;
      const activeLocations = locationsRes.data?.filter(loc => loc.is_active).length || 0;
      const pendingDispatches = chargerDispatchesRes.data?.filter(
        dispatch => ['not_sent', 'pending_dispatch'].includes(dispatch.status)
      ).length || 0;

      return {
        totalItems: activeItems,
        totalLocations: activeLocations,
        pendingDispatches,
        totalDispatches: chargerDispatchesRes.count || 0
      };
    }
  });

  const StatCard = ({ title, value, icon: Icon, description }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Inventory Management</h2>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Items"
          value={stats?.totalItems || 0}
          icon={Package}
          description="Items in inventory"
        />
        <StatCard
          title="Locations"
          value={stats?.totalLocations || 0}
          icon={MapPin}
          description="Active locations"
        />
        <StatCard
          title="Charger Dispatches"
          value={stats?.totalDispatches || 0}
          icon={Truck}
          description="Total dispatches"
        />
        <StatCard
          title="Pending Dispatches"
          value={stats?.pendingDispatches || 0}
          icon={Package}
          description="Awaiting dispatch"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="items" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="dispatches">Charger Dispatch</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Inventory Items</h3>
            <Button onClick={() => setAddItemOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
          <InventoryItemsSimple />
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Locations</h3>
            <Button onClick={() => setAddLocationOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </div>
          <LocationsList />
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Suppliers</h3>
            <Button onClick={() => setAddSupplierOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          </div>
          <SuppliersList />
        </TabsContent>

        <TabsContent value="dispatches" className="space-y-4">
          <ChargerDispatchPanel />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Stock Transactions</h3>
          </div>
          <TransactionsList />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddItemModal 
        open={addItemOpen} 
        onOpenChange={setAddItemOpen}
      />
      <AddLocationModal 
        open={addLocationOpen} 
        onOpenChange={setAddLocationOpen}
      />
      <AddSupplierModal 
        open={addSupplierOpen} 
        onOpenChange={setAddSupplierOpen}
      />
    </div>
  );
}
