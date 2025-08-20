
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Package, Plus } from 'lucide-react';
import { StockRequestForm } from './StockRequestForm';

interface StockRequestButtonProps {
  engineerId: string;
  orderId?: string;
  prefilledItems?: Array<{ item_id: string; qty: number; notes?: string }>;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  children?: React.ReactNode;
}

export const StockRequestButton: React.FC<StockRequestButtonProps> = ({
  engineerId,
  orderId,
  prefilledItems,
  variant = 'default',
  size = 'default',
  children
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {children || (
            <>
              <Package className="h-4 w-4 mr-2" />
              Request Stock
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock Request</DialogTitle>
        </DialogHeader>
        <StockRequestForm
          engineerId={engineerId}
          orderId={orderId}
          prefilledItems={prefilledItems}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
