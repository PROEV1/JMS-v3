import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Edit3 } from 'lucide-react';
import { IncorrectStockForm } from './IncorrectStockForm';
import { usePurchaseOrderForStockRequest } from '@/hooks/usePurchaseOrderAmendment';

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
  
  // Check if there's a linked purchase order to determine button text
  const { data: purchaseOrder } = usePurchaseOrderForStockRequest(stockRequestId);
  
  const buttonText = purchaseOrder 
    ? "Amend Purchase Order" 
    : "Report Incorrect Stock";
    
  const buttonIcon = purchaseOrder ? Edit3 : AlertTriangle;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          className={purchaseOrder 
            ? "border-blue-300 text-blue-600 hover:bg-blue-50" 
            : "border-orange-300 text-orange-600 hover:bg-orange-50"
          }
        >
          {children || (
            <>
              {React.createElement(buttonIcon, { className: "h-4 w-4 mr-2" })}
              {buttonText}
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {purchaseOrder ? "Amend Purchase Order" : "Report Incorrect Stock"}
          </DialogTitle>
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