import { OrderSection } from "../OrderSectionLayout";
import { OrderProgressTimeline } from "../OrderProgressTimeline";
import { OrderStatusManager } from "../OrderStatusManager";
import { BarChart3 } from "lucide-react";

interface Order {
  id: string;
  status: string;
  status_enhanced: any;
  manual_status_override: boolean;
  manual_status_notes: string | null;
  amount_paid: number;
  total_amount: number;
  agreement_signed_at: string | null;
  scheduled_install_date: string | null;
  order_payments: Array<{
    paid_at: string | null;
    status: string;
  }>;
  engineer?: {
    name: string;
  } | null;
}

interface JobStatusTimelineSectionProps {
  order: Order;
  onUpdate: () => void;
}

export function JobStatusTimelineSection({ order, onUpdate }: JobStatusTimelineSectionProps) {
  return (
    <OrderSection 
      id="status-timeline" 
      title="Job Status & Timeline" 
      icon={BarChart3} 
      defaultOpen={true}
      forceOpen={true}
    >
      <div className="space-y-6">
        {/* Horizontal Progress Timeline */}
        <OrderProgressTimeline order={order} />
        
        {/* Status Management */}
        <OrderStatusManager
          orderId={order.id}
          currentStatus={order.status_enhanced}
          manualOverride={order.manual_status_override}
          manualNotes={order.manual_status_notes}
          onUpdate={onUpdate}
        />
      </div>
    </OrderSection>
  );
}