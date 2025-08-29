import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { IncorrectStockForm } from './IncorrectStockForm';

interface IncorrectStockButtonProps {
  engineerId: string;
  stockRequestId?: string;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline' | 'secondary';
  children?: React.ReactNode;
}

export const IncorrectStockButton: React.FC<IncorrectStockButtonProps> = ({
  engineerId,
  stockRequestId,
  size = 'default',
  variant = 'outline',
  children
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="border-orange-300 text-orange-600 hover:bg-orange-50">
          {children || (
            <>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Report Incorrect Stock
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Incorrect Stock</DialogTitle>
        </DialogHeader>
        <IncorrectStockForm
          engineerId={engineerId}
          stockRequestId={stockRequestId}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};