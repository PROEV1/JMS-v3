import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Package, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreateStockRequest } from '@/hooks/useStockRequests';

interface IncorrectStockFormProps {
  engineerId: string;
  onClose: () => void;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
}

interface Location {
  id: string;
  name: string;
  type: string;
}

export const IncorrectStockForm: React.FC<IncorrectStockFormProps> = ({
  engineerId,
  onClose
}) => {
  const { toast } = useToast();
  const createStockRequest = useCreateStockRequest();
  
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [actualQuantity, setActualQuantity] = useState<string>('');
  const [expectedQuantity, setExpectedQuantity] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Get inventory items
  const { data: items } = useQuery<InventoryItem[]>({
    queryKey: ['inventory-items-for-incorrect-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku, unit')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Get engineer's van location
  const { data: vanLocation } = useQuery<Location>({
    queryKey: ['engineer-van-location', engineerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name, type')
        .eq('engineer_id', engineerId)
        .eq('type', 'van')
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!engineerId
  });

  // Get warehouse locations as backup
  const { data: warehouseLocations } = useQuery<Location[]>({
    queryKey: ['warehouse-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name, type')
        .eq('type', 'warehouse')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  const handleSubmit = async () => {
    if (!selectedItem || !actualQuantity || !location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const selectedItemData = items?.find(item => item.id === selectedItem);
    if (!selectedItemData) return;

    const discrepancyNotes = `STOCK DISCREPANCY REPORT:
Item: ${selectedItemData.name} (${selectedItemData.sku})
Expected Quantity: ${expectedQuantity || 'Unknown'}
Actual Quantity Found: ${actualQuantity}
Discrepancy: ${expectedQuantity ? (Number(actualQuantity) - Number(expectedQuantity)) : 'N/A'}

Engineer Notes: ${notes || 'None'}

*** OFFICE ATTENTION REQUIRED ***
This report was submitted by the engineer to alert the office of incorrect stock levels.`;

    try {
      await createStockRequest.mutateAsync({
        engineer_id: engineerId,
        destination_location_id: location,
        priority: 'high',
        notes: discrepancyNotes,
        lines: [{
          item_id: selectedItem,
          qty: Math.abs(Number(actualQuantity) - Number(expectedQuantity || 0)) || 1,
          notes: `Stock adjustment needed - Found: ${actualQuantity}, Expected: ${expectedQuantity || 'Unknown'}`
        }]
      });

      toast({
        title: "Incorrect Stock Report Submitted",
        description: "The office has been notified of the stock discrepancy and will investigate.",
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit stock discrepancy report. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            Stock Discrepancy Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-orange-700">
            Use this form to report incorrect stock quantities found during your work. 
            This will alert the office to investigate and correct the stock levels.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="item">Item with Incorrect Stock *</Label>
          <Select value={selectedItem} onValueChange={setSelectedItem}>
            <SelectTrigger>
              <SelectValue placeholder="Select an item..." />
            </SelectTrigger>
            <SelectContent>
              {items?.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">({item.sku})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expected">Expected Quantity</Label>
            <Input
              id="expected"
              type="number"
              value={expectedQuantity}
              onChange={(e) => setExpectedQuantity(e.target.value)}
              placeholder="What should be there"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actual">Actual Quantity Found *</Label>
            <Input
              id="actual"
              type="number"
              value={actualQuantity}
              onChange={(e) => setActualQuantity(e.target.value)}
              placeholder="What you actually found"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location *</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger>
              <SelectValue placeholder="Select location..." />
            </SelectTrigger>
            <SelectContent>
              {vanLocation && (
                <SelectItem value={vanLocation.id}>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{vanLocation.name} (Your Van)</span>
                  </div>
                </SelectItem>
              )}
              {warehouseLocations?.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{loc.name} (Warehouse)</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Provide any additional context about the stock discrepancy..."
            rows={3}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={createStockRequest.isPending || !selectedItem || !actualQuantity || !location}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {createStockRequest.isPending ? 'Submitting...' : 'Submit Report'}
        </Button>
      </div>
    </div>
  );
};