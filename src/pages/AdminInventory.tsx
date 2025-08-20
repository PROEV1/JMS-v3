
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleInventoryDashboard } from "@/components/admin/inventory/SimpleInventoryDashboard";
import { InventoryItemsSimple } from "@/components/admin/inventory/InventoryItemsSimple";
import { LocationsList } from "@/components/admin/inventory/LocationsList";
import { SuppliersList } from "@/components/admin/inventory/SuppliersList";
import { TransactionsList } from "@/components/admin/inventory/TransactionsList";
import { AdminStockRequestsBoard } from "@/components/admin/inventory/AdminStockRequestsBoard";
import { useState } from "react";

const AdminInventory = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleTabSwitch = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <p className="text-muted-foreground">
          Manage inventory items, locations, stock levels, and requests
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="requests">Stock Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <SimpleInventoryDashboard onSwitchTab={handleTabSwitch} />
        </TabsContent>

        <TabsContent value="items">
          <InventoryItemsSimple />
        </TabsContent>

        <TabsContent value="locations">
          <LocationsList />
        </TabsContent>

        <TabsContent value="suppliers">
          <SuppliersList />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsList />
        </TabsContent>

        <TabsContent value="requests">
          <AdminStockRequestsBoard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminInventory;
