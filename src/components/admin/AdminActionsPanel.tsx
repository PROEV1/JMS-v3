import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Mail, UserCheck, Flag, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminActionsPanelProps {
  orderId: string;
  order: any;
}

export function AdminActionsPanel({ orderId, order }: AdminActionsPanelProps) {
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
        // Create a blob and download
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

  const handleEmailClientUpdate = async () => {
    try {
      // This would typically call an email service
      toast({
        title: "Feature Coming Soon",
        description: "Email client update functionality will be available soon",
      });
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: "Failed to send client update",
        variant: "destructive",
      });
    }
  };

  const handleReassignEngineer = () => {
    toast({
      title: "Feature Available",
      description: "Use the Installation Management panel to reassign the engineer",
    });
  };

  const handleFlagForReview = async () => {
    try {
      // Add a flag or note to the order
      toast({
        title: "Feature Coming Soon",
        description: "Flag for admin review functionality will be available soon",
      });
    } catch (error) {
      console.error('Error flagging order:', error);
      toast({
        title: "Error",
        description: "Failed to flag order for review",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Admin Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start"
          onClick={handleDownloadOrderSummary}
        >
          <Download className="h-4 w-4 mr-2" />
          Download Order Summary
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start"
          onClick={handleEmailClientUpdate}
        >
          <Mail className="h-4 w-4 mr-2" />
          Email Client Update
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start"
          onClick={handleReassignEngineer}
        >
          <UserCheck className="h-4 w-4 mr-2" />
          Reassign Engineer
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start"
          onClick={handleFlagForReview}
        >
          <Flag className="h-4 w-4 mr-2" />
          Flag for Review
        </Button>
      </CardContent>
    </Card>
  );
}