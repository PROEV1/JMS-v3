import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Mail, Flag, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OrderActionBarProps {
  orderId: string;
  order: any;
}

export function OrderActionBar({ orderId, order }: OrderActionBarProps) {
  const { toast } = useToast();

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
          <DropdownMenuItem onClick={handleFlagForReview}>
            <Flag className="h-4 w-4 mr-2" />
            Flag for Review
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}