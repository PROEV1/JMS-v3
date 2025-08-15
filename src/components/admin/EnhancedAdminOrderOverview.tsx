import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EnhancedJobStatusBadge, OrderStatusEnhanced } from "./EnhancedJobStatusBadge";
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
  Clock
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
    return format(new Date(dateString), 'PPP');
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return format(new Date(dateString), 'PPP p');
  };

  const getProgressSteps = () => {
    const steps = [
      {
        id: 'payment',
        label: 'Payment',
        completed: order.amount_paid >= order.total_amount,
        icon: CreditCard,
        details: `${formatCurrency(order.amount_paid)} / ${formatCurrency(order.total_amount)}`
      },
      {
        id: 'agreement',
        label: 'Agreement',
        completed: !!order.agreement_signed_at,
        icon: FileText,
        details: order.agreement_signed_at ? formatDateTime(order.agreement_signed_at) : 'Not signed'
      },
      {
        id: 'scheduling',
        label: 'Install Scheduled',
        completed: !!order.scheduled_install_date && !!order.engineer,
        icon: Calendar,
        details: order.scheduled_install_date 
          ? `${formatDate(order.scheduled_install_date)} - ${order.engineer?.name || 'No engineer'}`
          : 'Not scheduled'
      },
      {
        id: 'completion',
        label: 'Installation',
        completed: order.status === 'completed',
        icon: CheckCircle,
        details: order.status === 'completed' ? 'Complete' : 'Pending'
      }
    ];

    return steps;
  };

  const progressSteps = getProgressSteps();
  const completedSteps = progressSteps.filter(step => step.completed).length;

  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Client & Order Info */}
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Order Overview</h2>
            <EnhancedJobStatusBadge 
              status={order.status_enhanced} 
              manualOverride={order.manual_status_override}
            />
          </div>

          {/* Client Information */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Client Details
            </h3>
            <div className="space-y-2">
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
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{order.client.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Order Information */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Order Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Order Number:</span>
                <p className="font-mono">{order.order_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Quote Number:</span>
                <p className="font-mono">{order.quote.quote_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Order Value:</span>
                <p className="font-semibold">{formatCurrency(order.total_amount)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p>{formatDate(order.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Engineer Assignment */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Engineer Assignment
            </h3>
            {order.engineer ? (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.engineer.name}</span>
                <Badge variant="outline">{order.engineer.email}</Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>No engineer assigned</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Progress Tracker */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Job Progress
            </h3>
            <span className="text-sm text-muted-foreground">
              {completedSteps} of {progressSteps.length} completed
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedSteps / progressSteps.length) * 100}%` }}
            />
          </div>

          {/* Progress Steps */}
          <div className="space-y-4">
            {progressSteps.map((step, index) => {
              const IconComponent = step.icon;
              return (
                <div key={step.id} className="flex items-start gap-3">
                  <div className={`
                    p-2 rounded-full transition-colors
                    ${step.completed 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                    }
                  `}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${step.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                      {step.completed && (
                        <Badge variant="secondary" className="h-5 text-xs">
                          ✓
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.details}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t">
            <h4 className="font-medium text-sm mb-3">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(`mailto:${order.client.email}`, '_blank')}
              >
                <Mail className="h-4 w-4 mr-1" />
                Email Client
              </Button>
              {order.client.phone && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(`tel:${order.client.phone}`, '_blank')}
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Call Client
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}