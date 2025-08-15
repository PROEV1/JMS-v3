import { useState, useEffect } from "react";
import { OrderSection } from "../OrderSectionLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, 
  CheckCircle, 
  AlertCircle,
  Calendar
} from "lucide-react";
import { format, addDays } from "date-fns";

interface PaymentSectionProps {
  order: {
    id: string;
    total_amount: number;
    amount_paid: number;
    deposit_amount: number;
    scheduled_install_date: string | null;
    order_payments: Array<{
      id: string;
      amount: number;
      payment_type: string;
      status: string;
      paid_at: string | null;
      created_at: string;
    }>;
  };
}

interface PaymentConfig {
  payment_stage: 'deposit' | 'full' | 'staged';
  deposit_type: 'percentage' | 'fixed';
  deposit_amount: number;
  currency: string;
  balance_due_days_before_install?: number;
}

export function PaymentSection({ order }: PaymentSectionProps) {
  const { toast } = useToast();
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);

  useEffect(() => {
    fetchPaymentConfig();
  }, []);

  const fetchPaymentConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_config')
        .single();

      if (error) throw error;
      setPaymentConfig(data.setting_value as unknown as PaymentConfig);
    } catch (error) {
      console.error('Error fetching payment config:', error);
    }
  };

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

  const depositPaid = order.amount_paid >= order.deposit_amount;
  const paymentCompleted = order.amount_paid >= order.total_amount;
  const outstandingAmount = order.total_amount - order.amount_paid;

  // Calculate balance due date
  const getBalanceDueDate = () => {
    if (!order.scheduled_install_date || !paymentConfig) return null;
    
    const daysBeforeInstall = paymentConfig.balance_due_days_before_install || 0;
    const installDate = new Date(order.scheduled_install_date);
    const dueDate = addDays(installDate, -daysBeforeInstall);
    
    return dueDate;
  };

  const balanceDueDate = getBalanceDueDate();

  return (
    <OrderSection 
      id="payment" 
      title="Payment Management" 
      icon={CreditCard} 
      defaultOpen={!paymentCompleted}
    >
      <div className="space-y-6">
        {/* Payment Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-background border rounded-lg">
            <div className="text-sm text-muted-foreground">Total Order Value</div>
            <div className="text-2xl font-bold">{formatCurrency(order.total_amount)}</div>
          </div>
          
          <div className="p-4 bg-background border rounded-lg">
            <div className="text-sm text-muted-foreground">Amount Paid</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(order.amount_paid)}</div>
          </div>
          
          {outstandingAmount > 0 && (
            <div className="p-4 bg-background border rounded-lg">
              <div className="text-sm text-muted-foreground">Outstanding Balance</div>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(outstandingAmount)}</div>
              {balanceDueDate && (
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due: {format(balanceDueDate, 'PPP')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Payment Status</h4>
            <div className="flex gap-2">
              <Badge variant={depositPaid ? "default" : "secondary"}>
                {depositPaid ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Deposit Paid
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Deposit Pending
                  </>
                )}
              </Badge>
              
              {paymentConfig?.payment_stage === 'staged' && (
                <Badge variant={paymentCompleted ? "default" : "secondary"}>
                  {paymentCompleted ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Balance Paid
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Balance Due
                    </>
                  )}
                </Badge>
              )}
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit Amount:</span>
              <span className="font-semibold">{formatCurrency(order.deposit_amount)}</span>
            </div>
            
            {paymentConfig?.payment_stage === 'staged' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance Amount:</span>
                <span className="font-semibold">{formatCurrency(order.total_amount - order.deposit_amount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        {order.order_payments.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Payment History</h4>
            <div className="space-y-3">
              {order.order_payments.map((payment) => (
                <div key={payment.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium capitalize">{payment.payment_type} Payment</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(payment.paid_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(payment.amount)}</div>
                    <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Actions */}
        {!paymentCompleted && (
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-3">Payment Actions</h4>
            <div className="text-sm text-muted-foreground mb-3">
              {!depositPaid && "Deposit payment required before scheduling installation."}
              {depositPaid && !paymentCompleted && balanceDueDate && (
                `Balance payment due by ${format(balanceDueDate, 'PPP')}`
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Send Payment Reminder
              </Button>
              <Button variant="outline" size="sm">
                Process Manual Payment
              </Button>
            </div>
          </div>
        )}
      </div>
    </OrderSection>
  );
}