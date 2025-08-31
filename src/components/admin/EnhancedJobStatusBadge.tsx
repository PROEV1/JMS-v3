import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OrderStatusEnhanced = 
  | 'quote_accepted'
  | 'awaiting_payment'
  | 'payment_received'
  | 'awaiting_agreement'
  | 'agreement_signed'
  | 'awaiting_install_booking'
  | 'awaiting_survey_submission'
  | 'awaiting_survey_review'
  | 'survey_approved'
  | 'survey_rework_requested'
  | 'scheduled'
  | 'in_progress'
  | 'install_completed_pending_qa'
  | 'completed'
  | 'revisit_required'
  | 'awaiting_final_payment'
  | 'on_hold_parts_docs';

interface EnhancedJobStatusBadgeProps {
  status: OrderStatusEnhanced;
  manualOverride?: boolean;
  className?: string;
}

const statusConfig = {
  quote_accepted: {
    label: "Quote Accepted",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: "📝"
  },
  awaiting_payment: {
    label: "Awaiting Payment",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: "💳"
  },
  payment_received: {
    label: "Payment Received",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: "✅"
  },
  awaiting_agreement: {
    label: "Awaiting Agreement",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: "📄"
  },
  agreement_signed: {
    label: "Agreement Signed",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: "✍️"
  },
  awaiting_install_booking: {
    label: "Needs Scheduling",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: "📅"
  },
  awaiting_survey_submission: {
    label: "Awaiting Survey",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: "📋"
  },
  awaiting_survey_review: {
    label: "Survey Under Review",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: "👁️"
  },
  survey_approved: {
    label: "Survey Approved",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: "✅"
  },
  survey_rework_requested: {
    label: "Survey Rework Needed",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: "⚠️"
  },
  scheduled: {
    label: "Scheduled",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: "🗓️"
  },
  in_progress: {
    label: "In Progress",
    color: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: "🔧"
  },
  install_completed_pending_qa: {
    label: "Pending QA",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: "🔍"
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: "🎉"
  },
  revisit_required: {
    label: "Revisit Required",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: "⚠️"
  },
  awaiting_final_payment: {
    label: "Awaiting Final Payment",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: "💰"
  },
  on_hold_parts_docs: {
    label: "On Hold - Parts/Docs",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: "📦"
  }
};

export function EnhancedJobStatusBadge({ status, manualOverride, className }: EnhancedJobStatusBadgeProps) {
  const config = statusConfig[status];
  
  // Fallback for unknown statuses
  if (!config) {
    return (
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className={cn(
            "px-3 py-1 font-medium",
            "bg-gray-100 text-gray-800 border-gray-200",
            className
          )}
        >
          <span className="mr-1">❓</span>
          {status || 'Unknown Status'}
        </Badge>
        {manualOverride && (
          <Badge variant="secondary" className="text-xs">
            Manual Override
          </Badge>
        )}
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={cn(
          "px-3 py-1 font-medium",
          config.color,
          className
        )}
      >
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </Badge>
      {manualOverride && (
        <Badge variant="secondary" className="text-xs">
          Manual Override
        </Badge>
      )}
    </div>
  );
}