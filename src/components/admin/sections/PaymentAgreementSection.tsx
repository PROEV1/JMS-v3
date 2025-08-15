import { OrderSection } from "../OrderSectionLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Download
} from "lucide-react";
import { format } from "date-fns";

interface Order {
  id: string;
  total_amount: number;
  amount_paid: number;
  agreement_signed_at: string | null;
  agreement_document_url: string | null;
  order_payments: Array<{
    id: string;
    amount: number;
    payment_type: string;
    status: string;
    paid_at: string | null;
    created_at: string;
  }>;
}

interface PaymentAgreementSectionProps {
  order: Order;
}

export function PaymentAgreementSection({ order }: PaymentAgreementSectionProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Not completed';
    return format(new Date(dateString), 'PPP p');
  };

  const paymentCompleted = order.amount_paid >= order.total_amount;
  const agreementSigned = !!order.agreement_signed_at;
  const outstandingAmount = order.total_amount - order.amount_paid;

  const isCompleted = paymentCompleted && agreementSigned;

  return (
    <OrderSection 
      id="payment-agreement" 
      title="Payment & Agreement" 
      icon={CreditCard} 
      defaultOpen={!isCompleted}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Payment Status</h4>
            <Badge variant={paymentCompleted ? "default" : "secondary"}>
              {paymentCompleted ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Paid in Full
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Payment Pending
                </>
              )}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="font-semibold">{formatCurrency(order.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Paid:</span>
              <span className="font-semibold text-green-600">{formatCurrency(order.amount_paid)}</span>
            </div>
            {outstandingAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Outstanding:</span>
                <span className="font-semibold text-orange-600">{formatCurrency(outstandingAmount)}</span>
              </div>
            )}
          </div>

          {/* Payment History */}
          {order.order_payments.length > 0 && (
            <div className="pt-3 border-t">
              <h5 className="font-medium text-sm mb-2">Payment History</h5>
              <div className="space-y-2">
                {order.order_payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="capitalize">{payment.payment_type}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {payment.status}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(payment.amount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(payment.paid_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Agreement Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Agreement Status</h4>
            <Badge variant={agreementSigned ? "default" : "secondary"}>
              {agreementSigned ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Signed
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
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Agreement Signed</span>
                </div>
                <div className="text-sm text-green-700 mt-1">
                  Signed on {formatDateTime(order.agreement_signed_at)}
                </div>
              </div>

              {order.agreement_document_url && (
                <Button variant="outline" size="sm" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Signed Agreement
                </Button>
              )}
            </div>
          ) : (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Agreement Pending</span>
              </div>
              <div className="text-sm text-orange-700 mt-1">
                Client needs to sign the agreement to proceed
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section Summary */}
      <div className="mt-6 pt-4 border-t">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Payment & Agreement Status
          </span>
          <Badge variant={isCompleted ? "default" : "secondary"}>
            {isCompleted ? "✅ Complete" : "⏳ Pending"}
          </Badge>
        </div>
      </div>
    </OrderSection>
  );
}