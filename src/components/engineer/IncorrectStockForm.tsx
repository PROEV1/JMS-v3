import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePurchaseOrderForStockRequest } from '@/hooks/usePurchaseOrderAmendment';
import { AmendPurchaseOrderForm } from './AmendPurchaseOrderForm';

interface IncorrectStockFormProps {
  engineerId: string;
  stockRequestId?: string;
  onClose: () => void;
}

export const IncorrectStockForm: React.FC<IncorrectStockFormProps> = ({
  engineerId,
  stockRequestId,
  onClose
}) => {
  const { toast } = useToast();
  
  // Check if there's a linked purchase order
  const { data: purchaseOrder, isLoading } = usePurchaseOrderForStockRequest(stockRequestId);

  if (isLoading) {
    return <div className="p-4">Checking for existing purchase order...</div>;
  }

  // If there's no stock request ID, show error
  if (!stockRequestId) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <span>Cannot report stock issues without a stock request reference.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If there's a purchase order, show the amendment form
  if (purchaseOrder) {
    return (
      <AmendPurchaseOrderForm
        engineerId={engineerId}
        stockRequestId={stockRequestId}
        onClose={onClose}
      />
    );
  }

  // If no purchase order exists, show message that PO must be created first
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-800">
          <AlertTriangle className="h-5 w-5" />
          Purchase Order Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-yellow-700">
          To report stock issues, a purchase order must be created first for this stock request.
          Please contact the office to create a purchase order before reporting discrepancies.
        </p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};