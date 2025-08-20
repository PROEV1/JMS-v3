
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SimpleInventoryDashboard } from "@/components/admin/inventory/SimpleInventoryDashboard";
import { InventoryItemsSimple } from "@/components/admin/inventory/InventoryItemsSimple";
import { LocationsList } from "@/components/admin/inventory/LocationsList";
import { AddItemModal } from "@/components/admin/inventory/AddItemModal";
import { AddLocationModal } from "@/components/admin/inventory/AddLocationModal";
import { ChargerDispatchPanel } from "@/components/admin/inventory/ChargerDispatchPanel";

export default function AdminInventory() {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [addItemOpen, setAddItemOpen] = React.useState(false);
  const [addLocationOpen, setAddLocationOpen] = React.useState(false);

  const handleSwitchTab = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">
            Manage your inventory items, locations, and charger dispatches
          </p>
        </div>
        <div className="flex space-x-2">
          {activeTab === "items" && (
            <Button onClick={() => setAddItemOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          )}
          {activeTab === "locations" && (
            <Button onClick={() => setAddLocationOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="charger-dispatch">Charger Dispatch</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SimpleInventoryDashboard onSwitchTab={handleSwitchTab} />
        </TabsContent>

        <TabsContent value="items">
          <InventoryItemsSimple />
        </TabsContent>

        <TabsContent value="locations">
          <LocationsList />
        </TabsContent>

        <TabsContent value="charger-dispatch">
          <ChargerDispatchPanel onSwitchTab={handleSwitchTab} />
        </TabsContent>
      </Tabs>

      <AddItemModal 
        open={addItemOpen} 
        onOpenChange={setAddItemOpen}
      />

      <AddLocationModal 
        open={addLocationOpen} 
        onOpenChange={setAddLocationOpen}
      />
    </div>
  );
}
