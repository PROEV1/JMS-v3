import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, User, Calendar, FileText, CreditCard } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  scheduled_install_date: string | null;
  agreement_signed_at: string | null;
  installation_notes: string | null;
  engineer_id: string | null;
  client: {
    full_name: string;
    email: string;
    phone?: string;
  };
  quote: {
    quote_number: string;
  };
  order_payments: Array<{
    status: string;
    amount: number;
  }>;
  engineer?: {
    name: string;
  };
}

interface AdminOrderOverviewProps {
  order: Order;
}

export function AdminOrderOverview({ order }: AdminOrderOverviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getStatusIcon = (completed: boolean) => {
    return completed ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-yellow-500" />
    );
  };

  const hasPayments = order.order_payments.some(p => p.status === 'paid');
  const hasAgreement = order.agreement_signed_at !== null;
  const hasPreferences = order.installation_notes !== null;
  const hasScheduledInstall = order.scheduled_install_date !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Admin Order Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Client Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Client Details</h4>
            <p className="font-semibold">{order.client.full_name}</p>
            <p className="text-sm text-muted-foreground">{order.client.email}</p>
            {order.client.phone && (
              <p className="text-sm text-muted-foreground">{order.client.phone}</p>
            )}
          </div>
          
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Order Reference</h4>
            <p className="font-semibold">{order.order_number}</p>
            <p className="text-sm text-muted-foreground">Quote: {order.quote.quote_number}</p>
          </div>
          
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Order Value</h4>
            <p className="font-semibold">{formatCurrency(order.total_amount)}</p>
            <p className="text-sm text-muted-foreground">
              Paid: {formatCurrency(order.amount_paid)}
            </p>
          </div>
        </div>

        {/* Status Dashboard */}
        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-3">Progress Status</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              {getStatusIcon(hasPayments)}
              <CreditCard className="h-4 w-4" />
              <span className="text-sm">Payment</span>
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusIcon(hasAgreement)}
              <FileText className="h-4 w-4" />
              <span className="text-sm">Agreement</span>
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusIcon(hasPreferences)}
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Preferences</span>
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusIcon(hasScheduledInstall)}
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Installation</span>
            </div>
          </div>
        </div>

        {/* Assignment & Scheduling */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Assigned Engineer</h4>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-sm">
                {order.engineer?.name || 'Not Assigned'}
              </span>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Installation Date</h4>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
               <span className="text-sm">
                 {order.scheduled_install_date 
                   ? new Date(order.scheduled_install_date).toLocaleDateString('en-GB', {
                       day: '2-digit',
                       month: '2-digit',
                       year: 'numeric'
                     })
                   : 'Not Booked'
                 }
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}