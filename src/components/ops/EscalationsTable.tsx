import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Mail, Calendar, CreditCard, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EscalationItem {
  id: string;
  jobIdentifier: string;
  clientName: string;
  status: string;
  slaTarget: string;
  timeOverdue: string;
  overdueHours: number;
  responsible: 'Client' | 'Ops' | 'Finance';
  quickAction: string;
  actionType: 'survey_reminder' | 'schedule_booking' | 'payment_followup' | 'general';
  orderId?: string;
  orderNumber?: string;
}

export function EscalationsTable() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEscalations = async () => {
    try {
      setLoading(true);

      // Fetch overdue items from various sources
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Fetch orders with various overdue conditions
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status_enhanced,
          created_at,
          scheduled_install_date,
          agreement_signed_at,
          clients!inner(full_name, email)
        `)
        .or(`
          and(status_enhanced.eq.awaiting_survey_submission,created_at.lt.${threeDaysAgo.toISOString()}),
          and(status_enhanced.eq.awaiting_install_booking,created_at.lt.${sevenDaysAgo.toISOString()}),
          and(status_enhanced.eq.awaiting_payment,created_at.lt.${sevenDaysAgo.toISOString()}),
          and(status_enhanced.eq.scheduled,scheduled_install_date.lt.${new Date().toISOString().split('T')[0]})
        `);

      if (error) throw error;

      const escalationItems: EscalationItem[] = (orders || []).map((order) => {
        const createdAt = new Date(order.created_at);
        const hoursOverdue = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
        
        let status = '';
        let slaTarget = '';
        let responsible: 'Client' | 'Ops' | 'Finance' = 'Ops';
        let quickAction = '';
        let actionType: EscalationItem['actionType'] = 'general';

        switch (order.status_enhanced) {
          case 'awaiting_survey_submission':
            status = 'Awaiting Survey';
            slaTarget = '72h';
            responsible = 'Client';
            quickAction = 'Send Reminder';
            actionType = 'survey_reminder';
            break;
          case 'awaiting_install_booking':
            status = 'Install Pending';
            slaTarget = '7 days';
            responsible = 'Ops';
            quickAction = 'Schedule';
            actionType = 'schedule_booking';
            break;
          case 'awaiting_payment':
            status = 'Payment Due';
            slaTarget = '7 days';
            responsible = 'Finance';
            quickAction = 'Follow Up';
            actionType = 'payment_followup';
            break;
          case 'scheduled':
            if (order.scheduled_install_date && new Date(order.scheduled_install_date) < new Date()) {
              status = 'Overdue Install';
              slaTarget = 'Same day';
              responsible = 'Ops';
              quickAction = 'Contact Engineer';
              actionType = 'general';
            }
            break;
          default:
            return null;
        }

        if (!status) return null;

        const timeOverdue = hoursOverdue > 24 
          ? `+${Math.floor(hoursOverdue / 24)}d` 
          : `+${hoursOverdue}h`;

        return {
          id: order.id,
          jobIdentifier: `${order.clients?.full_name} / #${order.order_number}`,
          clientName: order.clients?.full_name || 'Unknown',
          status,
          slaTarget,
          timeOverdue,
          overdueHours: hoursOverdue,
          responsible,
          quickAction,
          actionType,
          orderId: order.id,
          orderNumber: order.order_number,
        };
      }).filter(Boolean) as EscalationItem[];

      // Sort by most overdue first
      escalationItems.sort((a, b) => b.overdueHours - a.overdueHours);

      setEscalations(escalationItems);
    } catch (error) {
      console.error('Error fetching escalations:', error);
      toast({
        title: "Error",
        description: "Failed to load escalations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (item: EscalationItem) => {
    try {
      switch (item.actionType) {
        case 'survey_reminder':
          // Call survey reminder function
          const { error: reminderError } = await supabase.functions.invoke('send-survey-reminders', {
            body: { orderIds: [item.orderId] }
          });
          if (reminderError) throw reminderError;
          toast({
            title: "Success",
            description: "Survey reminder sent successfully",
          });
          break;

        case 'schedule_booking':
          navigate(`/admin/schedule/status/needs-scheduling?orderId=${item.orderId}`);
          break;

        case 'payment_followup':
          navigate(`/admin/orders/${item.orderId}?tab=payments`);
          break;

        default:
          navigate(`/admin/orders/${item.orderId}`);
          break;
      }
    } catch (error) {
      console.error('Error performing quick action:', error);
      toast({
        title: "Error",
        description: "Failed to perform action",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchEscalations();

    // Refresh every 5 minutes
    const interval = setInterval(fetchEscalations, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const getResponsibleColor = (responsible: string) => {
    switch (responsible) {
      case 'Client': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Finance': return 'bg-green-50 text-green-700 border-green-200';
      case 'Ops': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (actionType: EscalationItem['actionType']) => {
    switch (actionType) {
      case 'survey_reminder': return <Mail className="h-4 w-4" />;
      case 'schedule_booking': return <Calendar className="h-4 w-4" />;
      case 'payment_followup': return <CreditCard className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Escalations & SLA Breaches
        </h2>
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          {escalations.length} items
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading escalations...</p>
            </div>
          ) : escalations.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-green-700">All Clear!</p>
              <p className="text-muted-foreground">No SLA breaches or escalations at this time.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA Target</TableHead>
                  <TableHead>Time Overdue</TableHead>
                  <TableHead>Responsible</TableHead>
                  <TableHead>Quick Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalations.map((item) => (
                  <TableRow 
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/orders/${item.orderId}`)}
                  >
                    <TableCell className="font-medium">
                      {item.jobIdentifier}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.slaTarget}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-red-600">
                        {item.timeOverdue}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getResponsibleColor(item.responsible)}>
                        {item.responsible}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAction(item);
                        }}
                        className="flex items-center gap-1"
                      >
                        {getStatusIcon(item.actionType)}
                        {item.quickAction}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}