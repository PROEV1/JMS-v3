import { Badge } from "@/components/ui/badge";
import { EnhancedJobStatusBadge, OrderStatusEnhanced } from "./EnhancedJobStatusBadge";
import { format } from "date-fns";

interface Order {
  id: string;
  order_number: string;
  status_enhanced: OrderStatusEnhanced;
  manual_status_override: boolean;
  scheduled_install_date: string | null;
  client: {
    full_name: string;
  };
  engineer?: {
    name: string;
  } | null;
}

interface OrderStickyHeaderProps {
  order: Order;
  isSticky: boolean;
}

export function OrderStickyHeader({ order, isSticky }: OrderStickyHeaderProps) {
  const formatInstallDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled';
    return format(new Date(dateString), 'dd MMM');
  };

  return (
    <div 
      className={`
        sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b
        transition-all duration-200
        ${isSticky ? 'shadow-sm' : ''}
      `}
    >
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold">{order.client.full_name}</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-mono text-muted-foreground">{order.order_number}</span>
            <span className="text-muted-foreground">|</span>
            <EnhancedJobStatusBadge 
              status={order.status_enhanced} 
              manualOverride={order.manual_status_override}
              className="text-xs"
            />
            {order.scheduled_install_date && (
              <>
                <span className="text-muted-foreground">|</span>
                <span>Install: {formatInstallDate(order.scheduled_install_date)}</span>
              </>
            )}
            {order.engineer && (
              <>
                <span className="text-muted-foreground">|</span>
                <span>Engineer: {order.engineer.name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}