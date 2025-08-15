import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  CreditCard, 
  FileText, 
  Calendar, 
  Wrench, 
  CheckCircle 
} from "lucide-react";
import { format } from "date-fns";

interface Order {
  amount_paid: number;
  total_amount: number;
  agreement_signed_at: string | null;
  scheduled_install_date: string | null;
  status: string;
  status_enhanced: string;
  order_payments: Array<{
    paid_at: string | null;
    status: string;
  }>;
  engineer?: {
    name: string;
  } | null;
}

interface OrderProgressTimelineProps {
  order: Order;
}

export function OrderProgressTimeline({ order }: OrderProgressTimelineProps) {
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return null;
    return format(new Date(dateString), 'PPP');
  };

  const getStages = () => {
    const paymentCompleted = order.amount_paid >= order.total_amount;
    const agreementSigned = !!order.agreement_signed_at;
    const installScheduled = !!order.scheduled_install_date && !!order.engineer;
    const workInProgress = order.status_enhanced === 'work_in_progress';
    const completed = order.status === 'completed' || order.status_enhanced === 'work_completed';

    return [
      {
        id: 'payment',
        label: 'Payment',
        icon: CreditCard,
        completed: paymentCompleted,
        active: !paymentCompleted,
        timestamp: order.order_payments.find(p => p.status === 'paid')?.paid_at
      },
      {
        id: 'agreement',
        label: 'Agreement',
        icon: FileText,
        completed: agreementSigned,
        active: paymentCompleted && !agreementSigned,
        timestamp: order.agreement_signed_at
      },
      {
        id: 'scheduled',
        label: 'Scheduled',
        icon: Calendar,
        completed: installScheduled,
        active: paymentCompleted && agreementSigned && !installScheduled,
        timestamp: order.scheduled_install_date
      },
      {
        id: 'install',
        label: 'Install',
        icon: Wrench,
        completed: workInProgress || completed,
        active: installScheduled && !workInProgress && !completed,
        timestamp: null // Would need install start time
      },
      {
        id: 'completed',
        label: 'Complete',
        icon: CheckCircle,
        completed: completed,
        active: workInProgress && !completed,
        timestamp: null // Would need completion time
      }
    ];
  };

  const stages = getStages();
  const completedCount = stages.filter(stage => stage.completed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Job Progress</span>
        <span className="text-sm text-muted-foreground">
          {completedCount} of {stages.length} completed
        </span>
      </div>
      
      {/* Progress Timeline */}
      <div className="relative px-4">
        {/* Background line */}
        <div className="absolute top-6 left-8 right-8 h-0.5 bg-muted" />
        
        {/* Progress line */}
        <div 
          className="absolute top-6 left-8 h-0.5 bg-primary transition-all duration-500"
          style={{ 
            width: completedCount > 0 
              ? `calc(${((completedCount - 1) / (stages.length - 1)) * 100}% + 2px)`
              : '0%'
          }}
        />
        
        {/* Stage containers */}
        <div className="flex justify-between items-start">
          {stages.map((stage, index) => {
            const IconComponent = stage.icon;
            const isCompleted = stage.completed;
            const isActive = stage.active;
            
            return (
              <div 
                key={stage.id} 
                className="flex flex-col items-center space-y-2 relative"
                style={{ width: `${100 / stages.length}%` }}
              >
                {/* Icon circle */}
                <div 
                  className={cn(
                    "relative w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background transition-all duration-300 z-10",
                    isCompleted 
                      ? "border-primary text-primary" 
                      : isActive
                      ? "border-primary text-primary"
                      : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4 fill-primary text-background" />
                  ) : (
                    <IconComponent className="h-4 w-4" />
                  )}
                </div>
                
                {/* Label and details */}
                <div className="text-center max-w-20">
                  <div className={cn(
                    "text-xs font-medium",
                    isCompleted || isActive ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {stage.label}
                  </div>
                  
                  {stage.timestamp && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(stage.timestamp)}
                    </div>
                  )}
                  
                  {isActive && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      Current
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}