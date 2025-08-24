import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Download, Mail, Flag, MoreVertical, Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface OrderActionBarProps {
  orderId: string;
  order: any;
}

export function OrderActionBar({ orderId, order }: OrderActionBarProps) {
  const { toast } = useToast();
  const [activeOfferToken, setActiveOfferToken] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveOffer();
  }, [orderId]);

  const fetchActiveOffer = async () => {
    try {
      const { data, error } = await supabase
        .from('job_offers')
        .select('client_token')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setActiveOfferToken(data?.client_token || null);
    } catch (error) {
      console.error('Error fetching active offer:', error);
    }
  };

  const handleDownloadOrderSummary = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-quote-pdf', {
        body: {
          quoteId: order.quote.id,
          type: 'order_summary'
        }
      });

      if (error) throw error;

      if (data) {
        const blob = new Blob([data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Order-Summary-${order.order_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading order summary:', error);
      toast({
        title: "Error",
        description: "Failed to download order summary",
        variant: "destructive",
      });
    }
  };

  const handleEmailClient = () => {
    window.open(`mailto:${order.client.email}`, '_blank');
  };

  const handleFlagForReview = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Flag for admin review functionality will be available soon",
    });
  };

  const handleCopyOfferLink = () => {
    if (activeOfferToken) {
      const offerUrl = `${window.location.origin}/offers/${activeOfferToken}`;
      navigator.clipboard.writeText(offerUrl);
      toast({
        title: "Link Copied",
        description: "Offer URL copied to clipboard",
      });
    }
  };

  const handleDeleteOrder = async () => {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('admin-delete-order', {
        body: { orderId }
      });

      if (error) throw error;

      toast({
        title: "Order Deleted",
        description: "Order has been successfully deleted",
      });

      // Redirect to orders list
      window.location.href = '/admin/orders';
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "Failed to delete order",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleEmailClient}
        className="hidden sm:flex"
      >
        <Mail className="h-4 w-4 mr-2" />
        Email Client
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreVertical className="h-4 w-4" />
            <span className="hidden sm:ml-2 sm:inline">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleDownloadOrderSummary}>
            <Download className="h-4 w-4 mr-2" />
            Download Order Summary
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEmailClient} className="sm:hidden">
            <Mail className="h-4 w-4 mr-2" />
            Email Client
          </DropdownMenuItem>
          {activeOfferToken && (
            <DropdownMenuItem onClick={handleCopyOfferLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Offer Link
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleFlagForReview}>
            <Flag className="h-4 w-4 mr-2" />
            Flag for Review
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDeleteOrder} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Order
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}