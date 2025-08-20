
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, MapPin, AlertTriangle, CheckCircle } from "lucide-react";

interface InventoryStatsProps {
  onSwitchTab: (tab: string) => void;
}

export function SimpleInventoryDashboard({ onSwitchTab }: InventoryStatsProps) {
  // Basic inventory stats
  const { data: itemStats } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, is_active, is_charger');
      
      if (error) throw error;
      
      const total = data.length;
      const active = data.filter(item => item.is_active).length;
      const chargers = data.filter(item => item.is_charger && item.is_active).length;
      
      return { total, active, chargers };
    }
  });

  // Charger dispatch stats
  const { data: dispatchStats } = useQuery({
    queryKey: ['dispatch-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charger_dispatches' as any)
        .select('status');
      
      if (error) throw error;
      
      const pending = data.filter((d: any) => d.status === 'pending_dispatch').length;
      const sent = data.filter((d: any) => d.status === 'sent').length;
      const delivered = data.filter((d: any) => d.status === 'delivered').length;
      
      return { pending, sent, delivered, total: data.length };
    }
  });

  // Location stats
  const { data: locationStats } = useQuery({
    queryKey: ['location-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, type, is_active');
      
      if (error) throw error;
      
      const total = data.filter(location => location.is_active).length;
      const vans = data.filter(location => location.type === 'van' && location.is_active).length;
      const warehouses = data.filter(location => location.type === 'warehouse' && location.is_active).length;
      
      return { total, vans, warehouses };
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Inventory Overview</h2>
        <p className="text-muted-foreground">
          Quick overview of your inventory system
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onSwitchTab('items')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{itemStats?.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              of {itemStats?.total || 0} total items
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onSwitchTab('items')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Charger Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{itemStats?.chargers || 0}</div>
            <p className="text-xs text-muted-foreground">
              high-value items
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onSwitchTab('locations')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locationStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {locationStats?.vans || 0} vans, {locationStats?.warehouses || 0} warehouses
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onSwitchTab('charger-dispatch')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispatches</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dispatchStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {dispatchStats?.pending || 0} pending, {dispatchStats?.delivered || 0} delivered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Inventory Items</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your inventory items, including chargers and other components.
          </p>
          <button 
            onClick={() => onSwitchTab('items')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View Items →
          </button>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-2">Stock Locations</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Manage warehouses, engineer vans, and other storage locations.
          </p>
          <button 
            onClick={() => onSwitchTab('locations')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View Locations →
          </button>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-2">Charger Dispatch</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Track charger dispatches for scheduled installations.
          </p>
          <button 
            onClick={() => onSwitchTab('charger-dispatch')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View Dispatches →
          </button>
        </Card>
      </div>
    </div>
  );
}
