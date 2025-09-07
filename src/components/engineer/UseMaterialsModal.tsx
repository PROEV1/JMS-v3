import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Wrench, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface UseMaterialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engineerId: string;
  vanLocationId: string;
  stockItems: Array<{
    id: string;
    name: string;
    sku: string;  
    unit: string;
    on_hand: number;
  }>;
}

export function UseMaterialsModal({ 
  open, 
  onOpenChange, 
  engineerId,
  vanLocationId,
  stockItems 
}: UseMaterialsModalProps) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [usageQuantity, setUsageQuantity] = useState('1');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Get engineer's current orders/jobs
  const { data: orders = [] } = useQuery({
    queryKey: ['engineer-orders', engineerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          clients(full_name),
          scheduled_install_date,
          status_enhanced
        `)
        .eq('engineer_id', engineerId)
        .in('status_enhanced', ['scheduled', 'in_progress'])
        .order('scheduled_install_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!engineerId
  });

  const recordUsageMutation = useMutation({
    mutationFn: async () => {
      const selectedItem = stockItems.find(item => item.id === selectedItemId);
      if (!selectedItem || !selectedOrderId) {
        throw new Error('Please select both an item and a job');
      }

      const quantity = parseInt(usageQuantity);
      if (quantity <= 0 || quantity > selectedItem.on_hand) {
        throw new Error(`Invalid quantity. Available: ${selectedItem.on_hand}`);
      }

      // Record material usage
      const { error: usageError } = await supabase
        .from('engineer_materials_used')
        .insert([{
          order_id: selectedOrderId,
          engineer_id: engineerId,
          item_id: selectedItemId,
          item_name: selectedItem.name,
          quantity,
          location_id: vanLocationId,
          notes: notes || `Used ${quantity} ${selectedItem.unit} of ${selectedItem.name}`,
          used_at: new Date().toISOString()
        }]);

      if (usageError) throw usageError;

      // Create inventory transaction to reduce van stock
      const { error: txnError } = await supabase
        .from('inventory_txns')
        .insert([{
          item_id: selectedItemId,
          location_id: vanLocationId,
          direction: 'out',
          qty: quantity,
          status: 'approved',
          reference: `Material usage on order ${orders.find(o => o.id === selectedOrderId)?.order_number}`,
          notes: `Used on job - ${notes || 'Material usage'}`,
          approved_at: new Date().toISOString(),
          approved_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (txnError) throw txnError;

      return { selectedItem, quantity };
    },
    onSuccess: ({ selectedItem, quantity }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['van-stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['van-stock-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['materials-used'] });
      queryClient.invalidateQueries({ queryKey: ['van-recent-transactions'] });

      toast({
        title: "Materials Used Recorded",
        description: `Recorded usage of ${quantity} ${selectedItem.unit} of ${selectedItem.name}`,
      });

      // Reset form
      setSelectedItemId('');
      setUsageQuantity('1');
      setSelectedOrderId('');
      setNotes('');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error recording material usage:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to record material usage",
        variant: "destructive"
      });
    }
  });

  const selectedItem = stockItems.find(item => item.id === selectedItemId);
  const selectedOrder = orders.find(order => order.id === selectedOrderId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordUsageMutation.mutate();
  };

  const handleReset = () => {
    setSelectedItemId('');
    setUsageQuantity('1');
    setSelectedOrderId('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Record Material Usage
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Select Job */}
          <div className="space-y-2">
            <Label>Job/Order *</Label>
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select job to record materials for..." />
              </SelectTrigger>
              <SelectContent>
                {orders.length > 0 ? (
                  orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>
                          {order.order_number} - {order.clients?.full_name}
                        </span>
                        <Badge variant="secondary" className="text-xs ml-2">
                          {order.status_enhanced}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem disabled value="none">
                    No active jobs available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {selectedOrderId && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Selected: {selectedOrder?.order_number}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/engineer/jobs/${selectedOrderId}`)}
                  className="h-auto p-1"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Select Item */}
          <div className="space-y-2">
            <Label>Item to Use *</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId} required>
              <SelectTrigger>
                <SelectValue placeholder="Choose item from van stock..." />
              </SelectTrigger>
              <SelectContent>
                {stockItems.length > 0 ? (
                  stockItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex justify-between items-center w-full">
                        <span>{item.name}</span>
                        <Badge variant="outline" className="text-xs ml-2">
                          {item.on_hand} {item.unit}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem disabled value="none">
                    No items in van stock
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {selectedItem && (
              <div className="text-xs text-muted-foreground">
                Available: {selectedItem.on_hand} {selectedItem.unit} • SKU: {selectedItem.sku}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity Used *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={selectedItem?.on_hand || 1}
              value={usageQuantity}
              onChange={(e) => setUsageQuantity(e.target.value)}
              placeholder="Enter quantity..."
              required
            />
            {selectedItem && (
              <div className="text-xs text-muted-foreground">
                Max available: {selectedItem.on_hand} {selectedItem.unit}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details about material usage..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleReset}
              disabled={recordUsageMutation.isPending}
            >
              Clear
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={recordUsageMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={
                !selectedItemId || 
                !selectedOrderId || 
                !usageQuantity || 
                parseInt(usageQuantity) <= 0 ||
                recordUsageMutation.isPending
              }
            >
              {recordUsageMutation.isPending ? 'Recording...' : 'Record Usage'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}