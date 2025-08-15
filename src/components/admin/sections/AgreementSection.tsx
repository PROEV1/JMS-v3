import { OrderSection } from "../OrderSectionLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Download,
  Send,
  Eye
} from "lucide-react";
import { format } from "date-fns";

interface AgreementSectionProps {
  order: {
    id: string;
    agreement_signed_at: string | null;
    agreement_document_url: string | null;
    quote: {
      id: string;
    };
  };
}

export function AgreementSection({ order }: AgreementSectionProps) {
  const { toast } = useToast();
  const agreementSigned = !!order.agreement_signed_at;

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Not completed';
    return format(new Date(dateString), 'PPP p');
  };

  const handleViewAgreement = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-quote-pdf', {
        body: {
          quoteId: order.quote.id,
          type: 'agreement'
        }
      });

      if (error) throw error;

      if (data) {
        const htmlBlob = new Blob([data], { type: 'text/html' });
        const htmlUrl = URL.createObjectURL(htmlBlob);
        window.open(htmlUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing agreement:', error);
      toast({
        title: "Error",
        description: "Failed to open agreement document",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAgreement = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-quote-pdf', {
        body: {
          quoteId: order.quote.id,
          type: 'agreement'
        }
      });

      if (error) throw error;

      if (data?.url) {
        const link = document.createElement('a');
        link.href = data.url;
        link.download = `Agreement-${order.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading agreement:', error);
      toast({
        title: "Error",
        description: "Failed to download agreement",
        variant: "destructive",
      });
    }
  };

  const handleSendAgreement = () => {
    toast({
      title: "Agreement Sent",
      description: "Agreement has been sent to the client for signature.",
    });
  };

  return (
    <OrderSection 
      id="agreement" 
      title="Service Agreement" 
      icon={FileText} 
      defaultOpen={!agreementSigned}
    >
      <div className="space-y-4">
        {/* Agreement Status */}
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Agreement Status</h4>
          <Badge variant={agreementSigned ? "default" : "secondary"}>
            {agreementSigned ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Signed & Complete
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Awaiting Signature
              </>
            )}
          </Badge>
        </div>

        {agreementSigned ? (
          /* Signed State */
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800 mb-2">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Agreement Successfully Signed</span>
              </div>
              <div className="text-sm text-green-700">
                <div>Signed on: {formatDateTime(order.agreement_signed_at)}</div>
                <div className="mt-1">Client has accepted all terms and conditions</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleViewAgreement}>
                <Eye className="h-4 w-4 mr-2" />
                View Agreement
              </Button>
              
              {order.agreement_document_url && (
                <Button variant="outline" size="sm" onClick={handleDownloadAgreement}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Signed Copy
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Unsigned State */
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 text-orange-800 mb-2">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Agreement Pending</span>
              </div>
              <div className="text-sm text-orange-700">
                <div>Client needs to review and sign the service agreement</div>
                <div className="mt-1">Installation cannot be scheduled until agreement is signed</div>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-medium text-sm">Available Actions</h5>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleViewAgreement}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Agreement
                </Button>
                
                <Button variant="outline" size="sm" onClick={handleSendAgreement}>
                  <Send className="h-4 w-4 mr-2" />
                  Send to Client
                </Button>
                
                <Button variant="outline" size="sm" onClick={handleDownloadAgreement}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              💡 Tip: The agreement will be automatically marked as signed when the client completes the digital signature process.
            </div>
          </div>
        )}
      </div>
    </OrderSection>
  );
}