
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, User, Phone, Mail, Package, CreditCard } from "lucide-react";
import { OrderStatusManager } from "@/components/admin/OrderStatusManager";
import { OrderActivityTimeline } from "@/components/admin/OrderActivityTimeline";
import { OrderProgressTimeline } from "@/components/admin/OrderProgressTimeline";
import { EngineerUploadsSection } from "@/components/admin/sections/EngineerUploadsSection";
import { EnhancedSurveySection } from "@/components/admin/sections/EnhancedSurveySection";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type OrderStatusEnhanced = Database['public']['Enums']['order_status_enhanced'];

export default function EnhancedClientOrderView() {
  const { id: orderId } = useParams();

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['client-order', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          clients!orders_client_id_fkey(
            id, 
            full_name, 
            email, 
            address, 
            postcode, 
            phone
          ),
          quotes!orders_quote_id_fkey(
            id,
            quote_number,
            total_cost,
            created_at
          ),
          order_payments!orders_id_fkey(
            id,
            amount,
            status,
            payment_type,
            payment_method,
            paid_at,
            created_at
          ),
          engineers!orders_engineer_id_fkey(
            id,
            name,
            email
          ),
          engineer_uploads!orders_id_fkey(
            id,
            file_name,
            file_url,
            upload_type,
            description,
            uploaded_at
          ),
          partners!orders_partner_id_fkey(
            name, 
            client_payment_required, 
            client_agreement_required, 
            client_survey_required
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      
      // Transform the data to match our interface, handling nullable relationships and ensuring arrays
      return {
        ...data,
        client: data.clients || null,
        quote: data.quotes || null,
        engineer: data.engineers || null,
        partner: data.partners || null,
        order_payments: Array.isArray(data.order_payments) ? data.order_payments : [],
        engineer_uploads: Array.isArray(data.engineer_uploads) ? data.engineer_uploads : []
      };
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Loading order details...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-600">
          Error loading order: {error?.message || 'Order not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Order {order.order_number}</h1>
          <p className="text-muted-foreground">
            Created {format(new Date(order.created_at), 'PPP')}
          </p>
        </div>
        <Badge variant={order.status_enhanced === 'completed' ? 'default' : 'secondary'}>
          {order.status_enhanced?.replace(/_/g, ' ').toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Information */}
          {order.client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium">{order.client.full_name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {order.client.email}
                    </div>
                    {order.client.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {order.client.phone}
                      </div>
                    )}
                  </div>
                  {order.job_address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div className="text-sm">
                        <p className="font-medium">Installation Address</p>
                        <p className="text-muted-foreground">{order.job_address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Installation Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Installation Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.scheduled_install_date && (
                <div>
                  <p className="font-medium">Scheduled Date</p>
                  <p className="text-muted-foreground">
                    {format(new Date(order.scheduled_install_date), 'PPP')}
                  </p>
                </div>
              )}
              {order.engineer && (
                <div>
                  <p className="font-medium">Assigned Engineer</p>
                  <p className="text-muted-foreground">{order.engineer.name}</p>
                </div>
              )}
              {order.estimated_duration_hours && (
                <div>
                  <p className="font-medium">Estimated Duration</p>
                  <p className="text-muted-foreground">{order.estimated_duration_hours} hours</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Progress */}
          <OrderProgressTimeline order={order} />

          {/* Survey Section */}
          <EnhancedSurveySection orderId={order.id} />

          {/* Engineer Uploads */}
          <EngineerUploadsSection order={order} onUpdate={() => refetch()} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Amount:</span>
                  <span className="font-medium">£{order.total_amount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="font-medium">£{order.amount_paid}</span>
                </div>
                <div className="flex justify-between">
                  <span>Balance:</span>
                  <span className="font-medium">£{order.total_amount - order.amount_paid}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          {order.order_payments && order.order_payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.order_payments.map((payment: any) => (
                    <div key={payment.id} className="border-b pb-2 last:border-b-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">£{payment.amount}</span>
                        <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                          {payment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {payment.payment_type} • {format(new Date(payment.created_at), 'PPP')}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Management */}
          <OrderStatusManager 
            orderId={order.id}
            currentStatus={order.status_enhanced as any}
            manualOverride={order.manual_status_override || false}
            manualNotes={order.manual_status_notes}
            onUpdate={() => refetch()}
          />

          {/* Activity Timeline */}
          <OrderActivityTimeline orderId={order.id} />
        </div>
      </div>
    </div>
  );
}
