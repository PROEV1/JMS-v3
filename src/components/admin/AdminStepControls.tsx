import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CreditCard, FileText, Calendar, CheckCircle, Upload, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminStepControlsProps {
  orderId: string;
  order: any;
  onUpdate: () => void;
}

export function AdminStepControls({ orderId, order, onUpdate }: AdminStepControlsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [manualPaymentAmount, setManualPaymentAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState(order.admin_qa_notes || '');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const hasPayments = order.order_payments?.some((p: any) => p.status === 'paid') || false;
  const hasAgreement = order.agreement_signed_at !== null;
  const hasPreferences = order.installation_notes !== null;
  const isCompleted = order.status === 'completed';

  const handleMarkAsPaid = async () => {
    if (!manualPaymentAmount || parseFloat(manualPaymentAmount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Insert manual payment record
      const { error: paymentError } = await supabase
        .from('order_payments')
        .insert({
          order_id: orderId,
          amount: parseFloat(manualPaymentAmount),
          payment_type: 'manual',
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'admin_override'
        });

      if (paymentError) throw paymentError;

      // Update order amount_paid
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          amount_paid: order.amount_paid + parseFloat(manualPaymentAmount),
          status: order.amount_paid + parseFloat(manualPaymentAmount) >= order.total_amount ? 'paid' : 'deposit_paid'
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      toast({
        title: "Success",
        description: `Payment of ${formatCurrency(parseFloat(manualPaymentAmount))} recorded`,
      });

      setManualPaymentAmount('');
      onUpdate();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAgreementSigned = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          agreement_signed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agreement marked as signed",
      });

      onUpdate();
    } catch (error) {
      console.error('Error marking agreement as signed:', error);
      toast({
        title: "Error",
        description: "Failed to mark agreement as signed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCompleted = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          admin_qa_notes: adminNotes
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Order marked as completed",
      });

      onUpdate();
    } catch (error) {
      console.error('Error marking order as completed:', error);
      toast({
        title: "Error",
        description: "Failed to mark order as completed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Payment Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Management
            {hasPayments && <Badge variant="secondary">Paid</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Total: {formatCurrency(order.total_amount)}</p>
              <p className="text-sm text-muted-foreground">Paid: {formatCurrency(order.amount_paid)}</p>
              <p className="text-sm text-muted-foreground">
                Outstanding: {formatCurrency(order.total_amount - order.amount_paid)}
              </p>
            </div>
          </div>
          
          {!hasPayments && (
            <div className="space-y-2">
              <Label htmlFor="manual-payment">Manual Payment Entry</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-payment"
                  type="number"
                  placeholder="Payment amount"
                  value={manualPaymentAmount}
                  onChange={(e) => setManualPaymentAmount(e.target.value)}
                />
                <Button onClick={handleMarkAsPaid} disabled={loading}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agreement Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Agreement Management
            {hasAgreement && <Badge variant="secondary">Signed</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasAgreement ? (
            <Button onClick={handleMarkAgreementSigned} disabled={loading}>
              <FileText className="h-4 w-4 mr-2" />
              Mark as Signed
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Signed: {new Date(order.agreement_signed_at).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Install Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Install Preferences
            {hasPreferences && <Badge variant="secondary">Submitted</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasPreferences ? (
            <div className="space-y-2">
              <Label>Client Notes:</Label>
              <p className="text-sm bg-muted p-2 rounded">{order.installation_notes}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No preferences submitted yet</p>
          )}
        </CardContent>
      </Card>

      {/* Completion Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Order Completion
            {isCompleted && <Badge variant="secondary">Completed</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-notes">Admin QA Notes</Label>
            <Textarea
              id="admin-notes"
              placeholder="Quality assurance notes, final review comments..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
            />
          </div>
          
          {!isCompleted && (
            <Button onClick={handleMarkCompleted} disabled={loading} className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Job as Completed
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}