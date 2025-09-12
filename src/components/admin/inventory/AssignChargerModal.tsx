import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, MapPin, Zap, Search, Package } from "lucide-react";
import { getBestPostcode } from "@/lib/utils/postcode";

interface Engineer {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface Location {
  id: string;
  name: string;
  type: string;
  engineer_id?: string;
  is_active: boolean;
}

interface ChargerUnit {
  id: string;
  charger_item_id: string;
  serial_number: string;
  status: string;
  engineer_id: string | null;
  engineer_name: string | null;
  location_id: string | null;
  location_name: string | null;
  assigned_order_id?: string | null;
}

interface Order {
  id: string;
  order_number: string;
  scheduled_install_date?: string | null;
  status_enhanced: string;
  client_id: string;
  engineer_id?: string | null;
  clients?: {
    full_name: string;
    address?: string;
    postcode?: string;
    phone?: string;
  };
}

interface AssignChargerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charger: ChargerUnit | null;
  chargerModel: string;
}

export function AssignChargerModal({ open, onOpenChange, charger, chargerModel }: AssignChargerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>('');
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [searchPostcode, setSearchPostcode] = useState<string>('');
  // Removed engineer search functionality and admin requirements

  // Reset form when modal opens
  React.useEffect(() => {
    if (open && charger) {
      setSelectedEngineerId(charger.engineer_id || '');
      setLocationAddress(charger.location_name || '');
      setSelectedOrderId(charger.assigned_order_id || 'none');
      setSearchPostcode('');
    }
  }, [open, charger]);

  // Fetch engineers
  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name, email, is_active')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Engineer[];
    }
  });

  // Fetch inventory locations
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name, type, engineer_id, is_active')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Location[];
    }
  });

  // Search orders by postcode using edge function to bypass RLS
  const { data: searchedOrders = [], isLoading: isSearchingOrders, error: searchError } = useQuery({
    queryKey: ['orders-search', searchPostcode],
    queryFn: async () => {
      if (!searchPostcode || searchPostcode.length < 2) return [];
      
      console.log('Searching with postcode:', searchPostcode);
      
      try {
        // First try direct query (for users who can see orders normally)
        const { data: directData, error: directError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            scheduled_install_date,
            status_enhanced,
            client_id,
            engineer_id,
            clients (
              full_name,
              address,
              postcode,
              phone
            )
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        if (!directError && directData) {
          // Filter client-side for postcode match
          const filteredOrders = directData.filter(order => {
            if (!order.clients) return false;
            
            const orderPostcode = (order.clients.postcode || '').toLowerCase();
            const orderAddress = (order.clients.address || '').toLowerCase();
            const searchTerm = searchPostcode.toLowerCase();
            const cleanPostcode = searchPostcode.replace(/\s+/g, '').toLowerCase();
            const postcodeStart = cleanPostcode.substring(0, Math.min(4, cleanPostcode.length));
            
            return orderPostcode.includes(searchTerm) ||
                   orderAddress.includes(searchTerm) ||
                   orderPostcode.includes(postcodeStart) ||
                   orderPostcode.replace(/\s+/g, '').includes(cleanPostcode);
          });
          
          console.log('Direct query filtered orders:', filteredOrders);
          return filteredOrders as Order[];
        }

        // If direct query fails (RLS blocking), use edge function
        console.log('Direct query failed, using edge function:', directError);
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('search-orders-bypass-rls', {
          body: { search_postcode: searchPostcode }
        });
        
        if (edgeError) {
          console.error('Edge function error:', edgeError);
          throw edgeError;
        }
        
        console.log('Edge function orders:', edgeData);
        return edgeData as Order[];
        
      } catch (error) {
        console.error('Search error:', error);
        throw error;
      }
    },
    enabled: Boolean(searchPostcode && searchPostcode.length >= 2),
    retry: 1
  });

  const assignChargerMutation = useMutation({
    mutationFn: async ({ engineerId, address, orderId }: { engineerId: string; address: string; orderId?: string }) => {
      if (!charger) throw new Error('No charger selected');

      // Handle special values
      const finalEngineerId = engineerId === 'unassigned' ? null : engineerId;
      
      // Determine status and location based on assignment
      let status = 'available';
      let finalLocationId = null;
      
      if (finalEngineerId && finalEngineerId !== 'unassigned') {
        // Assigned to engineer
        status = 'dispatched';
        
        // Get engineer's van location or create one
        const { data: existingLocation } = await supabase
          .from('inventory_locations')
          .select('id')
          .eq('engineer_id', finalEngineerId)
          .eq('type', 'van')
          .single();

        if (existingLocation) {
          finalLocationId = existingLocation.id;
        } else {
          // Create van location for engineer
          const engineer = engineers.find(e => e.id === finalEngineerId);
          const { data: newLocation, error: locationError } = await supabase
            .from('inventory_locations')
            .insert({
              name: `Van Stock - ${engineer?.name}`,
              type: 'van',
              engineer_id: finalEngineerId,
              address: address || null
            })
            .select()
            .single();

          if (locationError) throw locationError;
          finalLocationId = newLocation.id;
        }
        
        // Update existing van location address if provided
        if (address && finalLocationId) {
          const engineer = engineers.find(e => e.id === finalEngineerId);
          await supabase
            .from('inventory_locations')
            .update({ 
              address,
              name: `Van Stock - ${engineer?.name}${address ? ` - ${address}` : ''}` 
            })
            .eq('id', finalLocationId);
        }
      } else if (orderId && orderId !== 'none') {
        // Assigned to job without engineer - don't create job_site locations
        status = 'assigned';
        // Location remains null - charger is assigned to order but not physically located
      }

      // Update the charger_inventory record with the engineer, location, and order assignment
      const { data, error } = await supabase
        .from('charger_inventory')
        .update({
          engineer_id: finalEngineerId,
          location_id: finalLocationId,
          assigned_order_id: orderId || null,
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', charger.id)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw new Error(error.message || 'Failed to assign charger');
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Charger ${charger?.serial_number} assigned successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["charger-items"] });
      queryClient.invalidateQueries({ queryKey: ["charger-metrics"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error assigning charger:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign charger",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Engineer assignment is now optional - can proceed without selecting an engineer
    assignChargerMutation.mutate({
      engineerId: selectedEngineerId || 'unassigned',
      address: locationAddress,
      orderId: selectedOrderId === 'none' ? null : selectedOrderId
    });
  };

  if (!charger) return null;

  const selectedEngineer = engineers.find(e => e.id === selectedEngineerId);

  // Handle order selection to auto-populate address
  const handleOrderSelection = (orderId: string) => {
    setSelectedOrderId(orderId);
    
    if (orderId && orderId !== 'none') {
      const selectedOrder = searchedOrders.find(o => o.id === orderId);
      if (selectedOrder && selectedOrder.clients) {
        // Build full address from client data
        const addressParts = [];
        if (selectedOrder.clients.address) {
          addressParts.push(selectedOrder.clients.address);
        }
        if (selectedOrder.clients.postcode) {
          addressParts.push(selectedOrder.clients.postcode);
        }
        
        if (addressParts.length > 0) {
          setLocationAddress(addressParts.join(', '));
        }
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Assign Charger
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Charger Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{chargerModel}</h4>
              <Badge variant={charger.status === 'available' ? 'secondary' : 'default'}>
                {charger.status || 'Available'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">SN: {charger.serial_number}</p>
            {charger.engineer_name && (
              <p className="text-sm">
                <span className="text-muted-foreground">Currently assigned to:</span> {charger.engineer_name}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Engineer Selection */}
            <div className="space-y-2">
              <Label htmlFor="engineer">
                <User className="w-4 h-4 inline mr-2" />
                Assign to Engineer (Optional)
              </Label>
              <Select value={selectedEngineerId} onValueChange={setSelectedEngineerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select engineer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {engineers.map((engineer) => (
                    <SelectItem key={engineer.id} value={engineer.id}>
                      Van Stock - {engineer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Postcode Search for Orders */}
            <div className="space-y-2">
              <Label htmlFor="postcode-search">
                <Search className="w-4 h-4 inline mr-2" />
                Search Orders by Postcode
              </Label>
              <Input
                value={searchPostcode}
                onChange={(e) => setSearchPostcode(e.target.value)}
                placeholder="Enter postcode to find nearby orders..."
                className="w-full"
              />
              {isSearchingOrders && (searchPostcode.length >= 2) && (
                <p className="text-sm text-muted-foreground">Searching orders...</p>
              )}
              {!isSearchingOrders && (searchPostcode.length >= 2) && searchedOrders.length === 0 && !searchError && (
                <p className="text-sm text-muted-foreground">No orders found for this search</p>
              )}
              {searchError && (
                <div className="text-sm text-destructive">
                  <p className="font-medium">Search Error:</p>
                  <p>{searchError.message}</p>
                </div>
              )}
            </div>

            {/* Order Selection */}
            {searchedOrders.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="order">
                  <Package className="w-4 h-4 inline mr-2" />
                  Assign to Order (Optional)
                </Label>
                <Select value={selectedOrderId} onValueChange={handleOrderSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select order..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific order</SelectItem>
                    {searchedOrders.map((order) => {
                      const postcode = getBestPostcode(
                        order.clients?.address,
                        order.clients?.postcode
                      );
                      return (
                        <SelectItem key={order.id} value={order.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {order.order_number} - {order.clients?.full_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {postcode} • {order.status_enhanced}
                              {order.scheduled_install_date && ` • ${new Date(order.scheduled_install_date).toLocaleDateString()}`}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Location Address Input */}
            <div className="space-y-2">
              <Label htmlFor="location">
                <MapPin className="w-4 h-4 inline mr-2" />
                Location Address (Optional)
              </Label>
              <Input
                value={locationAddress}
                onChange={(e) => {
                  console.log('Location address changing to:', e.target.value);
                  setLocationAddress(e.target.value);
                }}
                placeholder="Enter location address..."
                className="w-full"
              />
            </div>

            {/* Assignment Preview */}
            {(selectedEngineer || locationAddress || (selectedOrderId && selectedOrderId !== 'none')) && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1">
                <p className="text-sm font-medium">Assignment Preview:</p>
                {selectedEngineer && (
                  <p className="text-sm">
                    <User className="w-3 h-3 inline mr-1" />
                    Engineer: {selectedEngineer.name}
                  </p>
                )}
                {selectedOrderId && selectedOrderId !== 'none' && (
                  <p className="text-sm">
                    <Package className="w-3 h-3 inline mr-1" />
                    Order: {searchedOrders.find(o => o.id === selectedOrderId)?.order_number}
                  </p>
                )}
                {locationAddress && (
                  <p className="text-sm">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    Location: {selectedEngineer ? `Van Stock - ${selectedEngineer.name} (${locationAddress})` : locationAddress}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={assignChargerMutation.isPending}
              >
                {assignChargerMutation.isPending ? "Assigning..." : "Assign Charger"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}