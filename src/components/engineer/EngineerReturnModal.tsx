import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, ExternalLink, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface EngineerReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vanLocationId: string;
  vanLocationName: string;
  stockItems: Array<{
    id: string;
    name: string;
    sku: string;  
    unit: string;
    on_hand: number;
  }>;
}

export function EngineerReturnModal({ 
  open, 
  onOpenChange, 
  vanLocationId, 
  vanLocationName, 
  stockItems 
}: EngineerReturnModalProps) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('1');
  const [returnReason, setReturnReason] = useState('');
  const [returnType, setReturnType] = useState<'warehouse' | 'rma'>('warehouse');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Get suppliers for RMA
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-for-return'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_suppliers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open && returnType === 'rma'
  });

  // Return to warehouse mutation
  const returnToWarehouseMutation = useMutation({
    mutationFn: async ({ itemId, qty, reference, returnNotes }: {
      itemId: string;
      qty: number;
      reference: string;
      returnNotes: string;
    }) => {
      // Create outbound transaction from van
      const { error } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: itemId,
          location_id: vanLocationId,
          direction: 'out',
          qty: qty,
          reference: reference,
          notes: returnNotes,
          status: 'approved'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Stock Returned Successfully",
        description: `Returned ${returnQuantity} units to warehouse`,
      });
      handleSuccess();
    },
    onError: (error) => {
      console.error('Error returning stock:', error);
      toast({
        title: "Error Returning Stock",
        description: "Failed to return stock. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Create RMA mutation
  const createRmaMutation = useMutation({
    mutationFn: async ({ itemId, qty, reason, supplierNotes }: {
      itemId: string;
      qty: number;
      reason: string;
      supplierNotes: string;
    }) => {
      // First, remove stock from van
      const { error: txnError } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: itemId,
          location_id: vanLocationId,
          direction: 'out',
          qty: qty,
          reference: `RMA Return from ${vanLocationName}`,
          notes: `Creating RMA: ${reason}`,
          status: 'approved'
        });

      if (txnError) throw txnError;

      // Generate RMA number
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 9000) + 1000;
      const rmaNumber = `RMA${year}-${randomNum}`;

      // Create RMA record
      const currentUser = (await supabase.auth.getUser()).data.user;
      
      // Create one main RMA record
      const { data: rmaData, error: rmaError } = await supabase
        .from('returns_rmas')
        .insert({
          rma_number: rmaNumber,
          item_id: itemId, // Primary item for the RMA
          supplier_id: suppliers[0]?.id || null,
          return_reason: reason,
          notes: supplierNotes,
          status: 'pending_return',
          created_by: currentUser?.id
        })
        .select()
        .single();

      if (rmaError) throw rmaError;

      // Create line item for the quantity being returned
      const { error: lineError } = await supabase
        .from('returns_rma_lines')
        .insert({
          rma_id: rmaData.id,
          item_id: itemId,
          quantity: qty,
          condition_notes: supplierNotes
        });

      if (lineError) throw lineError;

      return { rmaNumber, recordCount: 1 };
    },
    onSuccess: (data) => {
      toast({
        title: "RMA Created Successfully",
        description: `Created RMA ${data.rmaNumber} with ${returnQuantity} units`,
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/admin/inventory')}
          >
            View RMAs
          </Button>
        )
      });
      handleSuccess();
    },
    onError: (error) => {
      console.error('Error creating RMA:', error);
      toast({
        title: "Error Creating RMA",
        description: "Failed to create RMA. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSuccess = () => {
    // Invalidate queries to refresh van stock
    queryClient.invalidateQueries({ queryKey: ['van-stock-items'] });
    queryClient.invalidateQueries({ queryKey: ['van-stock-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['van-recent-transactions'] });

    // Reset form
    setSelectedItemId('');
    setReturnQuantity('1');
    setReturnReason('');
    setNotes('');
    onOpenChange(false);
  };

  const handleReturn = () => {
    if (!selectedItemId) {
      toast({
        title: "No item selected",
        description: "Please select an item to return",
        variant: "destructive"
      });
      return;
    }

    const qty = parseInt(returnQuantity);
    if (!qty || qty <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid quantity",
        variant: "destructive"
      });
      return;
    }

    const selectedItem = stockItems.find(item => item.id === selectedItemId);
    if (!selectedItem) {
      toast({
        title: "Item not found",
        description: "Selected item not found in van stock",
        variant: "destructive"
      });
      return;
    }

    if (qty > selectedItem.on_hand) {
      toast({
        title: "Insufficient stock",
        description: `Only ${selectedItem.on_hand} units available in van`,
        variant: "destructive"
      });
      return;
    }

    if (!returnReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for the return",
        variant: "destructive"
      });
      return;
    }

    if (returnType === 'warehouse') {
      returnToWarehouseMutation.mutate({
        itemId: selectedItemId,
        qty,
        reference: `Return to warehouse from ${vanLocationName}`,
        returnNotes: `${returnReason}${notes ? ` - ${notes}` : ''}`
      });
    } else {
      createRmaMutation.mutate({
        itemId: selectedItemId,
        qty,
        reason: returnReason,
        supplierNotes: notes || `RMA created from van stock - ${vanLocationName}`
      });
    }
  };

  const selectedItem = stockItems.find(item => item.id === selectedItemId);
  const isPending = returnToWarehouseMutation.isPending || createRmaMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Return Stock from Van
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Return Type Selection */}
          <div className="grid gap-4 md:grid-cols-2">
            <div 
              className={`cursor-pointer p-4 border rounded-lg transition-all ${
                returnType === 'warehouse' 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/30'
              }`}
              onClick={() => setReturnType('warehouse')}
            >
              <div className="flex items-center gap-3 mb-2">
                <Package className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Return to Warehouse</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Return items back to main warehouse
              </p>
            </div>

            <div 
              className={`cursor-pointer p-4 border rounded-lg transition-all ${
                returnType === 'rma' 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/30'
              }`}
              onClick={() => setReturnType('rma')}
            >
              <div className="flex items-center gap-3 mb-2">
                <ExternalLink className="h-5 w-5 text-orange-600" />
                <span className="font-medium">Create RMA</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Return defective items to supplier
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item">Select Item to Return</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an item from van stock" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {stockItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{item.name} ({item.sku})</span>
                        <Badge variant="outline" className="ml-2">
                          {item.on_hand} {item.unit}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedItem && (
                <p className="text-xs text-muted-foreground">
                  Available: {selectedItem.on_hand} {selectedItem.unit}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity to Return</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={selectedItem?.on_hand || 1}
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Return Action</Label>
                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                  {returnType === 'warehouse' ? (
                    <>
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">To Warehouse</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">Create RMA</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Return *</Label>
              <Input
                id="reason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={returnType === 'warehouse' ? 
                  "e.g., Excess stock, job cancelled" : 
                  "e.g., Damaged, defective, wrong item"
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional details..."
                rows={3}
              />
            </div>

            <Button 
              onClick={handleReturn} 
              className="w-full"
              disabled={isPending}
            >
              {isPending ? 'Processing...' : 
                returnType === 'warehouse' ? 'Return to Warehouse' : 'Create RMA & Return'
              }
            </Button>
          </div>

          {returnType === 'rma' && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <ExternalLink className="h-4 w-4 text-orange-600" />
              <div className="text-sm">
                <p className="font-medium text-orange-900">RMA will be created</p>
                <p className="text-orange-700">
                  This will remove the item from your van and create a return request to the supplier.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}