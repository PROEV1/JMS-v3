import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { useUpdateStockRequestStatus } from '@/hooks/useStockRequests';
import { useToast } from '@/hooks/use-toast';
import { StockRequestWithDetails } from '@/types/stock-request';

interface MarkReceivedButtonProps {
  request: StockRequestWithDetails;
  size?: 'default' | 'sm' | 'lg';
}

export const MarkReceivedButton: React.FC<MarkReceivedButtonProps> = ({
  request,
  size = 'sm'
}) => {
  const { toast } = useToast();
  const updateStatus = useUpdateStockRequestStatus();

  const handleMarkReceived = async () => {
    try {
      await updateStatus.mutateAsync({
        id: request.id,
        status: 'cancelled',
        notes: `Marked as received by engineer on ${new Date().toLocaleString()}`
      });
      
      toast({
        title: "Stock Request Received",
        description: "Stock request has been marked as received successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark stock request as received. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Only show for in_transit requests
  if (request.status !== 'in_transit') {
    return null;
  }

  return (
    <Button 
      size={size}
      onClick={handleMarkReceived}
      disabled={updateStatus.isPending}
      className="bg-green-600 hover:bg-green-700 text-white"
    >
      <CheckCircle className="h-4 w-4 mr-1" />
      Mark Received
    </Button>
  );
};