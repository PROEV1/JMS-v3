import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Package, User, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RmaViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rma: any;
}

export function RmaViewModal({ open, onOpenChange, rma }: RmaViewModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const markAsReceivedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('returns_rmas')
        .update({
          status: 'received_by_supplier' as const,
          updated_at: new Date().toISOString()
        })
        .eq('id', rma.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "RMA Status Updated",
        description: `RMA ${rma.rma_number} marked as received`,
      });
      queryClient.invalidateQueries({ queryKey: ['returns-rmas'] });
      queryClient.invalidateQueries({ queryKey: ['rma-metrics'] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating RMA status:', error);
      toast({
        title: "Error Updating Status",
        description: "Failed to update RMA status. Please try again.",
        variant: "destructive"
      });
    }
  });

  if (!rma) return null;

  const getStatusText = (status: string) => {
    switch (status) {
      case 'received_by_supplier': return 'RECEIVED';
      default: return status.replace('_', ' ').toUpperCase();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_return': return 'bg-yellow-100 text-yellow-800';
      case 'in_transit': return 'bg-blue-100 text-blue-800';
      case 'received_by_supplier': return 'bg-green-100 text-green-800';
      case 'replacement_received': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalQuantity = rma.returns_rma_lines?.reduce((total: number, line: any) => total + line.quantity, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              RMA Details - {rma.rma_number}
            </div>
            {rma.status === 'in_transit' && (
              <Button 
                onClick={() => markAsReceivedMutation.mutate()}
                disabled={markAsReceivedMutation.isPending}
                size="sm"
                className="ml-auto"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {markAsReceivedMutation.isPending ? 'Updating...' : 'Mark as Received'}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
            <Badge className={getStatusColor(rma.status)}>
              {getStatusText(rma.status)}
            </Badge>
          </div>

          {/* Item Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Item Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm font-medium">Item:</span>
                <p className="text-sm text-muted-foreground">
                  {rma.inventory_items?.name} ({rma.inventory_items?.sku})
                </p>
              </div>
              <div>
                <span className="text-sm font-medium">Total Quantity:</span>
                <p className="text-sm text-muted-foreground">{totalQuantity}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Supplier:</span>
                <p className="text-sm text-muted-foreground">
                  {rma.inventory_suppliers?.name || 'N/A'}
                </p>
              </div>
              {rma.serial_number && (
                <div>
                  <span className="text-sm font-medium">Serial Number:</span>
                  <p className="text-sm text-muted-foreground">{rma.serial_number}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Return Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Return Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm font-medium">Reason:</span>
                <p className="text-sm text-muted-foreground">{rma.return_reason}</p>
              </div>
              {rma.notes && (
                <div>
                  <span className="text-sm font-medium">Notes:</span>
                  <p className="text-sm text-muted-foreground">{rma.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm font-medium">Created:</span>
                <p className="text-sm text-muted-foreground">
                  {new Date(rma.created_at).toLocaleDateString()} at {new Date(rma.created_at).toLocaleTimeString()}
                </p>
              </div>
              {rma.return_date && (
                <div>
                  <span className="text-sm font-medium">Return Date:</span>
                  <p className="text-sm text-muted-foreground">
                    {new Date(rma.return_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              {rma.replacement_expected_date && (
                <div>
                  <span className="text-sm font-medium">Expected Replacement:</span>
                  <p className="text-sm text-muted-foreground">
                    {new Date(rma.replacement_expected_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              {rma.replacement_received_date && (
                <div>
                  <span className="text-sm font-medium">Replacement Received:</span>
                  <p className="text-sm text-muted-foreground">
                    {new Date(rma.replacement_received_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Replacement Info */}
          {rma.replacement_serial_number && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Replacement Item
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <span className="text-sm font-medium">Replacement Serial:</span>
                  <p className="text-sm text-muted-foreground">{rma.replacement_serial_number}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Line Items Details */}
          {rma.returns_rma_lines && rma.returns_rma_lines.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Line Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rma.returns_rma_lines.map((line: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                      <span className="text-sm">Quantity: {line.quantity}</span>
                      {line.condition_notes && (
                        <span className="text-sm text-muted-foreground">
                          Notes: {line.condition_notes}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}