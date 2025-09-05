import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Package, User, FileText, AlertCircle } from 'lucide-react';

interface RmaViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rma: any;
}

export function RmaViewModal({ open, onOpenChange, rma }: RmaViewModalProps) {
  if (!rma) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_return': return 'bg-yellow-100 text-yellow-800';
      case 'in_transit': return 'bg-blue-100 text-blue-800';
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
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            RMA Details - {rma.rma_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
            <Badge className={getStatusColor(rma.status)}>
              {rma.status.replace('_', ' ').toUpperCase()}
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