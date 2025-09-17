import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function ApprovePendingTransactionsButton() {
  const [isApproving, setIsApproving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleApproveAll = async () => {
    setIsApproving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("User not authenticated");

      // Approve all pending transactions
      const { error, count } = await supabase
        .from('inventory_txns')
        .update({
          status: 'approved',
          approved_by: user.user.id,
          approved_at: new Date().toISOString()
        })
        .eq('status', 'pending');

      if (error) throw error;

      toast({
        title: "Transactions Approved",
        description: `Successfully approved ${count || 0} pending transactions`,
      });

      // Refresh all inventory data
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['item-location-balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-kpis'] });
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve transactions",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <Button
      onClick={handleApproveAll}
      disabled={isApproving}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isApproving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Check className="h-4 w-4" />
      )}
      {isApproving ? "Approving..." : "Approve All Pending"}
    </Button>
  );
}