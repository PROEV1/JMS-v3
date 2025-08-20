import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, MapPin, FileText, Truck, ShoppingCart, AlertTriangle, Building } from "lucide-react";
import { InventoryItemsSimple } from "@/components/admin/inventory/InventoryItemsSimple";
import { SimpleInventoryDashboard } from "@/components/admin/inventory/SimpleInventoryDashboard";
import { LocationsList } from "@/components/admin/inventory/LocationsList";
import { SuppliersList } from "@/components/admin/inventory/SuppliersList";
import { TransactionsList } from "@/components/admin/inventory/TransactionsList";
import { StockTransferPanel } from "@/components/admin/inventory/StockTransferPanel";
import { QuickReceivePanel } from "@/components/admin/inventory/QuickReceivePanel";

export default function AdminInventory() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const switchToTab = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">
            Manage stock, locations, and materials
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Items
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Suppliers
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Requests
          </TabsTrigger>
          <TabsTrigger value="purchases" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Purchases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <SimpleInventoryDashboard onSwitchTab={switchToTab} />
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
          <StockTransferPanel />
        </TabsContent>

        <TabsContent value="purchases">
          <QuickReceivePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}