
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Warehouse, Truck, Building, User } from "lucide-react";

interface Location {
  id: string;
  name: string;
  code: string | null;
  type: string;
  address: string | null;
  is_active: boolean;
  engineer_id: string | null;
  engineer_name?: string;
}

export function LocationsList() {
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select(`
          *,
          engineers(name)
        `)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      
      return data.map(location => ({
        ...location,
        engineer_name: (location.engineers as any)?.name
      })) as Location[];
    }
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Locations ({locations.length})</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <Card key={location.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getLocationIcon(location.type)}
                  <CardTitle className="text-base">{location.name}</CardTitle>
                </div>
                <Badge className={getTypeColor(location.type)}>
                  {location.type}
                </Badge>
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

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm">
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
    </div>
  );
}
