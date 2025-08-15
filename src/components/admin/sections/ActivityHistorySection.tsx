import { OrderSection } from "../OrderSectionLayout";
import { OrderActivityTimeline } from "../OrderActivityTimeline";
import { Activity } from "lucide-react";

interface ActivityHistorySectionProps {
  orderId: string;
}

export function ActivityHistorySection({ orderId }: ActivityHistorySectionProps) {
  return (
    <OrderSection 
      id="activity-history" 
      title="Activity & History" 
      icon={Activity} 
      defaultOpen={false}
    >
      <OrderActivityTimeline orderId={orderId} />
    </OrderSection>
  );
}