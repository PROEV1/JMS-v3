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

  // If there's no stock request ID, show form for creating new request
  if (!stockRequestId) {
    return (
      <AmendPurchaseOrderForm
        engineerId={engineerId}
        stockRequestId=""  // Empty string indicates new request
        onClose={onClose}
      />
    );
  }

  // Always show the amendment form - it handles both PO and non-PO cases
  return (
    <AmendPurchaseOrderForm
      engineerId={engineerId}
      stockRequestId={stockRequestId}
      onClose={onClose}
    />
  );
};