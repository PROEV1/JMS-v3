
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Warehouse, Truck, Building, User, DollarSign, Hash, Plus, Edit, Trash2 } from "lucide-react";
import { AddLocationModal } from './AddLocationModal';
import { EditLocationModal } from './EditLocationModal';
import { LocationStockModal } from './LocationStockModal';
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';

interface Location {
  id: string;
  name: string;
  code: string | null;
  type: string;
  address: string | null;
  is_active: boolean;
  engineer_name?: string;
}

export function LocationsList() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const { data: locations = [], isLoading, error } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('inventory_locations')
          .select(`
            *,
            engineers (
              name
            )
          `)
          .eq('is_active', true)
          .order('name');
        
        if (error) {
          console.error('Error fetching locations:', error);
          throw error;
        }
        
        return (data || []).map(location => ({
          ...location,
          engineer_name: location.engineers?.name || null
        })) as Location[];
      } catch (err) {
        console.error('Query error:', err);
        throw err;
      }
    }
  });

  // Header metrics
  const { data: metrics } = useQuery({
    queryKey: ['location-metrics', locations],
    queryFn: async () => {
      if (!locations) return null;
      
      const warehouses = locations.filter(l => l.type === 'warehouse').length;
      const vans = locations.filter(l => l.type === 'van').length;
      const totalStockValue = 0; // Placeholder
      
      return { warehouses, vans, totalStockValue, total: locations.length };
    },
    enabled: !!locations
  });

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'warehouse': return <Warehouse className="w-4 h-4" />;
      case 'van': return <Truck className="w-4 h-4" />;
      case 'supplier': return <Building className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'warehouse': return 'bg-blue-100 text-blue-800';
      case 'van': return 'bg-green-100 text-green-800';
      case 'supplier': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading locations...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Error loading locations: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Stock Locations</h2>
          <p className="text-muted-foreground">Manage warehouses, vans, and storage locations</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Location
        </Button>
      </div>

      {/* Header Metrics */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-3">
          <InventoryKpiTile
            title="Warehouses"
            value={metrics.warehouses}
            icon={Warehouse}
            variant="info"
            subtitle="Central storage"
          />
          <InventoryKpiTile
            title="Vans"
            value={metrics.vans}
            icon={Truck}
            variant="success"
            subtitle="Mobile inventory"
          />
          <InventoryKpiTile
            title="Total Stock Value"
            value={metrics.totalStockValue}
            icon={DollarSign}
            variant="neutral"
            subtitle="£ across all locations"
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <Card key={location.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getLocationIcon(location.type)}
                  <CardTitle className="text-base">{location.name}</CardTitle>
                </div>
                <StatusChip status="active">
                  {location.type}
                </StatusChip>
              </div>
              {location.code && (
                <p className="text-sm text-muted-foreground">Code: {location.code}</p>
              )}
            </CardHeader>
            
            <CardContent className="space-y-3">
              {location.engineer_name && (
                <div className="flex items-center space-x-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{location.engineer_name}</span>
                </div>
              )}
              
              {location.address && (
                <div className="flex items-start space-x-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{location.address}</span>
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2">
                <div className="flex gap-1">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedLocation(location);
                      setShowEditModal(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this location?')) {
                        try {
                          await supabase
                            .from('inventory_locations')
                            .update({ is_active: false })
                            .eq('id', location.id);
                          window.location.reload();
                        } catch (error) {
                          console.error('Error deleting location:', error);
                        }
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedLocation(location);
                    setShowStockModal(true);
                  }}
                >
                  View Stock
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {locations.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No locations found. Add your first location to get started.
        </div>
      )}
      
      <AddLocationModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />
      
      <EditLocationModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        location={selectedLocation}
      />
      
      <LocationStockModal
        open={showStockModal}
        onOpenChange={setShowStockModal}
        location={selectedLocation}
      />
    </div>
  );
}
