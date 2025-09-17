
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventoryDashboardV2 } from "@/components/admin/inventory/InventoryDashboardV2";
import { InventoryItemsSimple } from "@/components/admin/inventory/InventoryItemsSimple";
import { LocationsList } from "@/components/admin/inventory/LocationsList";
import { SuppliersList } from "@/components/admin/inventory/SuppliersList";
import { TransactionsListV2 } from "@/components/admin/inventory/TransactionsListV2";
import { AdminStockRequestsBoard } from "@/components/admin/inventory/AdminStockRequestsBoard";
import { PurchaseOrdersList } from "@/components/admin/inventory/PurchaseOrdersList";
import { ReturnsRmasList } from "@/components/admin/inventory/ReturnsRmasList";
import { useState } from "react";
import { ApprovePendingTransactionsButton } from "@/components/admin/inventory/ApprovePendingTransactionsButton";

const AdminInventory = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleTabSwitch = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory Management</h1>
        <p className="text-muted-foreground">
          Manage inventory items, locations, stock levels, and requests
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="requests">Stock Requests</TabsTrigger>
          <TabsTrigger value="returns">Returns & RMAs</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <InventoryDashboardV2 onSwitchTab={handleTabSwitch} />
        </TabsContent>

        <TabsContent value="items">
          <InventoryItemsSimple onSwitchTab={handleTabSwitch} />
        </TabsContent>

        <TabsContent value="locations">
          <LocationsList />
        </TabsContent>

        <TabsContent value="suppliers">
          <SuppliersList />
        </TabsContent>

        <TabsContent value="purchase-orders">
          <PurchaseOrdersList />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsListV2 />
        </TabsContent>

        <TabsContent value="requests">
          <AdminStockRequestsBoard />
        </TabsContent>

        <TabsContent value="returns">
          <ReturnsRmasList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminInventory;
