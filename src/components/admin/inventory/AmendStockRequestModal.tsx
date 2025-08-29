import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Package } from 'lucide-react';
import { StockRequestWithDetails } from '@/types/stock-request';
import { useUpdateStockRequestLines } from '@/hooks/useStockRequests';
import { supabase } from '@/integrations/supabase/client';

interface AmendStockRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: StockRequestWithDetails | null;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
}

interface RequestLine {
  id?: string;
  item_id: string;
  qty: number;
  notes?: string;
}

export const AmendStockRequestModal: React.FC<AmendStockRequestModalProps> = ({
  open,
  onOpenChange,
  request
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [lines, setLines] = useState<RequestLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const updateRequestLines = useUpdateStockRequestLines();

  useEffect(() => {
    if (open && request) {
      loadInventoryItems();
      initializeLines();
    }
  }, [open, request]);

  const loadInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku, unit, is_charger')
        .eq('is_active', true)
        .eq('is_charger', false) // Exclude charger items from stock requests
        .order('name');

      if (error) throw error;
      console.log('Loaded inventory items for amend modal:', data?.length, 'items');
      setItems(data || []);
    } catch (error) {
      console.error('Error loading inventory items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeLines = () => {
    if (!request) return;
    
    const initialLines = request.lines.map(line => ({
      id: line.id,
      item_id: line.item_id,
      qty: line.qty,
      notes: line.notes || ''
    }));
    
    setLines(initialLines);
  };

  const addLine = () => {
    setLines([...lines, { item_id: '', qty: 1, notes: '' }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof RequestLine, value: any) => {
    const updatedLines = [...lines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    setLines(updatedLines);
  };

  const handleSubmit = async () => {
    if (!request) return;

    const validLines = lines.filter(line => line.item_id && line.qty > 0);
    
    if (validLines.length === 0) {
      alert('Please add at least one valid item');
      return;
    }

    try {
      await updateRequestLines.mutateAsync({
        requestId: request.id,
        lines: validLines.map(({ id, ...line }) => line),
        status: 'submitted' // Reset to submitted after amendment
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating request:', error);
    }
  };

  const getItemById = (itemId: string) => {
    return items.find(item => item.id === itemId);
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Amend Stock Request #{request.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <span className="font-medium">Engineer:</span> {request.engineer.name}
            </div>
            <div>
              <span className="font-medium">Destination:</span> {request.destination_location.name}
            </div>
            <div>
              <span className="font-medium">Priority:</span>
              <Badge variant={request.priority === 'high' ? 'destructive' : 'secondary'} className="ml-2">
                {request.priority}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Created:</span> {new Date(request.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Request Items</h3>
              <Button onClick={addLine} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-4">Loading items...</div>
            ) : (
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="flex-1 grid grid-cols-12 gap-3 items-start">
                      {/* Item Selection */}
                      <div className="col-span-5">
                        <Select
                          value={line.item_id}
                          onValueChange={(value) => updateLine(index, 'item_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border border-border shadow-lg z-50 max-h-48 overflow-y-auto">
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="1"
                          value={line.qty}
                          onChange={(e) => updateLine(index, 'qty', parseInt(e.target.value) || 1)}
                          placeholder="Qty"
                        />
                      </div>

                      {/* Unit Display */}
                      <div className="col-span-2 flex items-center text-sm text-muted-foreground">
                        {line.item_id ? getItemById(line.item_id)?.unit || 'each' : 'each'}
                      </div>

                      {/* Notes */}
                      <div className="col-span-3">
                        <Input
                          value={line.notes || ''}
                          onChange={(e) => updateLine(index, 'notes', e.target.value)}
                          placeholder="Notes (optional)"
                        />
                      </div>
                    </div>

                    {/* Remove Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeLine(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {lines.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No items added yet. Click "Add Item" to get started.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={updateRequestLines.isPending || lines.length === 0 || lines.every(line => !line.item_id)}
            >
              {updateRequestLines.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};