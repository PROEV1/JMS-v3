import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdditionalLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

interface AdditionalLineItemsEditorProps {
  items: AdditionalLineItem[];
  onItemsChange: (items: AdditionalLineItem[]) => void;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  showTotal?: boolean;
}

export function AdditionalLineItemsEditor({ 
  items, 
  onItemsChange, 
  onAdd, 
  onRemove,
  showTotal = true 
}: AdditionalLineItemsEditorProps) {
  const { toast } = useToast();
  const [newItem, setNewItem] = useState<Omit<AdditionalLineItem, 'total_price'>>({
    description: '',
    quantity: 1,
    unit_price: 0,
    notes: ''
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const calculateItemTotal = (quantity: number, unitPrice: number) => {
    return quantity * unitPrice;
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const updateItem = (index: number, field: keyof AdditionalLineItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate total if quantity or unit_price changed
    if (field === 'quantity' || field === 'unit_price') {
      updatedItems[index].total_price = calculateItemTotal(
        updatedItems[index].quantity, 
        updatedItems[index].unit_price
      );
    }
    
    onItemsChange(updatedItems);
  };

  const removeItem = (index: number) => {
    if (onRemove) {
      onRemove(index);
    } else {
      const updatedItems = items.filter((_, i) => i !== index);
      onItemsChange(updatedItems);
    }
  };

  const addItem = () => {
    if (!newItem.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Description is required",
        variant: "destructive",
      });
      return;
    }

    if (newItem.quantity <= 0 || newItem.unit_price < 0) {
      toast({
        title: "Validation Error", 
        description: "Quantity must be greater than 0 and unit price cannot be negative",
        variant: "destructive",
      });
      return;
    }

    const itemToAdd: AdditionalLineItem = {
      ...newItem,
      total_price: calculateItemTotal(newItem.quantity, newItem.unit_price)
    };

    if (onAdd) {
      onAdd();
    } else {
      onItemsChange([...items, itemToAdd]);
    }

    // Reset form
    setNewItem({
      description: '',
      quantity: 1,
      unit_price: 0,
      notes: ''
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Additional Line Items</h4>
          <p className="text-sm text-muted-foreground">Add custom items not in the product catalog</p>
        </div>
        <Badge variant="outline">{items.length} items</Badge>
      </div>

      {/* Existing Items */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, index) => (
            <Card key={index} className="border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor={`desc-${index}`} className="text-xs">Description</Label>
                    <Input
                      id={`desc-${index}`}
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Item description"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`qty-${index}`} className="text-xs">Quantity</Label>
                    <Input
                      id={`qty-${index}`}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`price-${index}`} className="text-xs">Unit Price</Label>
                    <Input
                      id={`price-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {item.notes && (
                  <div className="mt-3">
                    <Label htmlFor={`notes-${index}`} className="text-xs">Notes</Label>
                    <Textarea
                      id={`notes-${index}`}
                      value={item.notes}
                      onChange={(e) => updateItem(index, 'notes', e.target.value)}
                      placeholder="Additional notes..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-semibold">{formatCurrency(item.total_price)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add New Item Form */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add Line Item
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="new-description">Description *</Label>
              <Input
                id="new-description"
                value={newItem.description}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Installation fee, Additional materials, etc."
              />
            </div>
            
            <div>
              <Label htmlFor="new-quantity">Quantity</Label>
              <Input
                id="new-quantity"
                type="number"
                min="1"
                value={newItem.quantity}
                onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="new-unit-price">Unit Price (£)</Label>
              <Input
                id="new-unit-price"
                type="number"
                min="0"
                step="0.01"
                value={newItem.unit_price}
                onChange={(e) => setNewItem(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
            </div>
            
            <div className="flex items-end">
              <div className="w-full">
                <Label className="text-sm text-muted-foreground">Calculated Total</Label>
                <div className="h-10 flex items-center justify-center bg-muted rounded-md border">
                  <span className="font-semibold">
                    {formatCurrency(calculateItemTotal(newItem.quantity, newItem.unit_price))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="new-notes">Notes (optional)</Label>
            <Textarea
              id="new-notes"
              value={newItem.notes}
              onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional details or specifications..."
              rows={2}
            />
          </div>

          <Button onClick={addItem} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Line Item
          </Button>
        </CardContent>
      </Card>

      {/* Total Summary */}
      {showTotal && items.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Additional Items Total</span>
              </div>
              <span className="text-lg font-bold">{formatCurrency(calculateGrandTotal())}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
