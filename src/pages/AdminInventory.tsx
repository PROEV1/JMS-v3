
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SimpleInventoryDashboard } from '@/components/admin/inventory/SimpleInventoryDashboard';
import { InventoryItemsSimple } from '@/components/admin/inventory/InventoryItemsSimple';
import { LocationsList } from '@/components/admin/inventory/LocationsList';
import { SuppliersList } from '@/components/admin/inventory/SuppliersList';
import { TransactionsList } from '@/components/admin/inventory/TransactionsList';
import { ChargerDispatchPanel } from '@/components/admin/inventory/ChargerDispatchPanel';
import { StockTransferPanel } from '@/components/admin/inventory/StockTransferPanel';
import { AdminStockRequestsBoard } from '@/components/admin/inventory/AdminStockRequestsBoard';

export default function AdminInventory() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="chargers">Charger Dispatch</TabsTrigger>
          <TabsTrigger value="transfers">Stock Transfers</TabsTrigger>
          <TabsTrigger value="requests">Stock Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <SimpleInventoryDashboard />
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

        <TabsContent value="chargers">
          <ChargerDispatchPanel />
        </TabsContent>

        <TabsContent value="transfers">
          <StockTransferPanel />
        </TabsContent>

        <TabsContent value="requests">
          <AdminStockRequestsBoard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
