import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EnhancedJobStatusBadge, OrderStatusEnhanced } from "./EnhancedJobStatusBadge";
import { PartnerJobBadge } from './PartnerJobBadge';
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  Mail, 
  Phone, 
  User, 
  Calendar, 
  MapPin, 
  FileText,
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight
} from "lucide-react";

interface Order {
  id: string;
  order_number: string;
  status: string;
  status_enhanced: OrderStatusEnhanced;
  manual_status_override: boolean;
  total_amount: number;
  amount_paid: number;
  agreement_signed_at: string | null;
  scheduled_install_date: string | null;
  created_at: string;
  job_type?: 'installation' | 'assessment' | 'service_call';
  is_partner_job?: boolean;
  sub_partner?: string;
  partner_status?: string;
  partner_external_url?: string;
  partners?: {
    name: string;
  };
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
  };
  engineer?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface EnhancedAdminOrderOverviewProps {
  order: Order;
}

export function EnhancedAdminOrderOverview({ order }: EnhancedAdminOrderOverviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return format(new Date(dateString), 'dd MMM yyyy');
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'HH:mm');
  };

  const getProgressSteps = () => {
    const steps = [
      {
        id: 'payment',
        label: 'Payment',
        completed: order.amount_paid >= order.total_amount,
        icon: CreditCard
      },
      {
        id: 'agreement', 
        label: 'Agreement',
        completed: !!order.agreement_signed_at,
        icon: FileText
      },
      {
        id: 'scheduling',
        label: 'Scheduled',
        completed: !!order.scheduled_install_date && !!order.engineer,
        icon: Calendar
      },
      {
        id: 'completion',
        label: 'Complete',
        completed: order.status === 'completed',
        icon: CheckCircle
      }
    ];

    return steps;
  };

  const progressSteps = getProgressSteps();
  const completedSteps = progressSteps.filter(step => step.completed).length;
  const nextStep = progressSteps.find(step => !step.completed);
  
  const outstandingAmount = order.total_amount - order.amount_paid;
  const hasOutstanding = outstandingAmount > 0;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Top Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Client Block */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Client</span>
              </div>
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => window.open(`mailto:${order.client.email}`, '_blank')}
                    >
                      <Mail className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Email client</TooltipContent>
                </Tooltip>
                {order.client.phone && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => window.open(`tel:${order.client.phone}`, '_blank')}
                      >
                        <Phone className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Call client</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <p className="font-semibold text-foreground">{order.client.full_name}</p>
            <p className="text-sm text-muted-foreground truncate">{order.client.email}</p>
            {order.client.address && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{order.client.address}</p>
            )}
          </Card>

          {/* Order Block */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Order</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold font-mono">{order.order_number}</p>
              <EnhancedJobStatusBadge 
                status={order.status_enhanced} 
                manualOverride={order.manual_status_override}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {order.job_type && (
                <Badge variant="secondary" className="text-xs h-5">
                  {order.job_type.charAt(0).toUpperCase() + order.job_type.slice(1).replace('_', ' ')}
                </Badge>
              )}
              <PartnerJobBadge
                isPartnerJob={order.is_partner_job}
                partnerName={order.partners?.name}
                subPartner={order.sub_partner}
                partnerStatus={order.partner_status}
                partnerUrl={order.partner_external_url}
              />
            </div>
          </Card>

          {/* Money Block */}
          <Card className={cn("p-4", hasOutstanding && "border-orange-200 bg-orange-50")}>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Payment</span>
              {hasOutstanding && (
                <AlertCircle className="h-3 w-3 text-orange-600" />
              )}
            </div>
            <p className="font-semibold text-lg">{formatCurrency(order.total_amount)}</p>
            {hasOutstanding ? (
              <p className="text-sm text-orange-600 font-medium">
                {formatCurrency(outstandingAmount)} outstanding
              </p>
            ) : (
              <p className="text-sm text-green-600">Fully paid</p>
            )}
          </Card>
        </div>

        {/* Progress Strip */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-sm">Progress</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {nextStep && (
                <>
                  <span>Next:</span>
                  <span className="font-medium">{nextStep.label}</span>
                  <ChevronRight className="h-3 w-3" />
                </>
              )}
              <span>{completedSteps} of {progressSteps.length}</span>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2 mb-4">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedSteps / progressSteps.length) * 100}%` }}
            />
          </div>

          {/* Horizontal Progress Steps */}
          <div className="flex items-center justify-between">
            {progressSteps.map((step, index) => {
              const IconComponent = step.icon;
              return (
                <Tooltip key={step.id}>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-1 cursor-help">
                      <div className={cn(
                        "p-2 rounded-full transition-colors border-2",
                        step.completed 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-background text-muted-foreground border-muted"
                      )}>
                        <IconComponent className="h-3 w-3" />
                      </div>
                      <span className={cn(
                        "text-xs font-medium",
                        step.completed ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {step.label}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{step.label}</p>
                    <p className="text-sm">
                      {step.completed ? "✓ Complete" : "Pending"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </Card>

        {/* Installation Card */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Installation</span>
            </div>
            {!order.scheduled_install_date && (
              <Button variant="outline" size="sm">
                Schedule Install
              </Button>
            )}
          </div>

          {order.scheduled_install_date ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{formatDate(order.scheduled_install_date)}</p>
                  {formatTime(order.scheduled_install_date) && (
                    <p className="text-sm text-muted-foreground">{formatTime(order.scheduled_install_date)}</p>
                  )}
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Scheduled
                </Badge>
              </div>
              {order.engineer ? (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium">{order.engineer.name}</span>
                  <span className="text-xs text-muted-foreground">({order.engineer.email})</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-2 border-t text-orange-600">
                  <AlertCircle className="h-3 w-3" />
                  <span className="text-sm">No engineer assigned</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Installation not yet scheduled</span>
            </div>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}