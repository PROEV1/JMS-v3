import { OrderSection } from "../OrderSectionLayout";
import { UnifiedInstallationForm } from "../UnifiedInstallationForm";
import { EngineerStatusBadge } from "../EngineerStatusBadge";
import { Wrench } from "lucide-react";

interface Order {
  id: string;
  engineer_id: string | null;
  engineer_status: string | null;
  scheduled_install_date: string | null;
  time_window: string | null;
  estimated_duration_hours: number | null;
  internal_install_notes: string | null;
  job_address: string | null;
  amount_paid: number;
  total_amount: number;
  deposit_amount: number;
  agreement_signed_at: string | null;
  engineer?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface InstallationManagementSectionProps {
  order: Order;
  onUpdate: () => void;
}

export function InstallationManagementSection({ order, onUpdate }: InstallationManagementSectionProps) {
  const paymentReceived = order.amount_paid >= order.deposit_amount;
  const agreementSigned = !!order.agreement_signed_at;
  const isScheduled = !!order.scheduled_install_date && !!order.engineer;
  
  return (
    <OrderSection 
      id="installation" 
      title="Installation Management" 
      icon={Wrench} 
      defaultOpen={!isScheduled}
    >
      <div className="space-y-4">
        {order.engineer_status && order.engineer_id && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium text-muted-foreground">Engineer Progress:</span>
            <EngineerStatusBadge status={order.engineer_status} />
            {order.engineer && (
              <span className="text-sm text-muted-foreground">by {order.engineer.name}</span>
            )}
          </div>
        )}
        
        <UnifiedInstallationForm
          orderId={order.id}
          currentEngineerId={order.engineer_id}
          currentInstallDate={order.scheduled_install_date}
          timeWindow={order.time_window}
          estimatedDuration={order.estimated_duration_hours}
          internalNotes={order.internal_install_notes}
          jobAddress={order.job_address}
          engineer={order.engineer}
          paymentReceived={paymentReceived}
          agreementSigned={agreementSigned}
          onUpdate={onUpdate}
        />
      </div>
    </OrderSection>
  );
}