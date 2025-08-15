import { OrderSection } from "../OrderSectionLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  CreditCard
} from "lucide-react";
import { format } from "date-fns";

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  created_at: string;
  client: {
    id: string;
    full_name: string;
    email: string;
    phone?: string | null;
    address: string | null;
  };
  quote: {
    id: string;
    quote_number: string;
    total_cost: number;
    product_details: string;
  };
}

interface OrderOverviewSectionProps {
  order: Order;
}

export function OrderOverviewSection({ order }: OrderOverviewSectionProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'PPP');
  };

  return (
    <OrderSection 
      id="overview" 
      title="Order Overview" 
      icon={FileText} 
      defaultOpen={true}
      forceOpen={true}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Information */}
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
              Client Details
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.client.full_name}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={`mailto:${order.client.email}`}
                  className="text-primary hover:underline"
                >
                  {order.client.email}
                </a>
              </div>
              
              {order.client.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`tel:${order.client.phone}`}
                    className="text-primary hover:underline"
                  >
                    {order.client.phone}
                  </a>
                </div>
              )}
              
              {order.client.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm">{order.client.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t">
            <h5 className="font-medium text-sm mb-3">Quick Actions</h5>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(`mailto:${order.client.email}`, '_blank')}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              {order.client.phone && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(`tel:${order.client.phone}`, '_blank')}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Order Information */}
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
              Order Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Order Number:</span>
                <p className="font-mono font-medium">{order.order_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground block">Quote Number:</span>
                <p className="font-mono font-medium">{order.quote.quote_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground block">Order Value:</span>
                <p className="font-semibold text-lg">{formatCurrency(order.total_amount)}</p>
              </div>
              <div>
                <span className="text-muted-foreground block">Created:</span>
                <p>{formatDate(order.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Product Summary */}
          <div className="pt-4 border-t">
            <h5 className="font-medium text-sm mb-2">Product Summary</h5>
            <div className="text-sm text-muted-foreground">
              {order.quote.product_details}
            </div>
          </div>
        </div>
      </div>
    </OrderSection>
  );
}